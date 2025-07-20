// fractalLandmarks.ts
import type { BBox } from "./canvas";
import { Container, Graphics } from "pixi.js";

/**
 * Public context you keep and pass to update.
 */
export interface FractalLandmarksContext {
    container: Container;
    /** call updateFractalLandmarks(...) each frame */
    seed: number;
    roots: BlobNode[];
    nodes: Map<string, BlobNode>;
    gfx: Map<string, Graphics>;
    config: FractalConfig;
}

/** Tunable parameters (reasonable defaults provided). */
export interface FractalConfig {
    rootCount: number; // number of top-level blobs
    rootRadiusRange: [number, number]; // world units, approximate radii for roots
    childRadiusFrac: [number, number]; // fraction of parent radius for children
    childCountRange: [number, number]; // per parent
    childAreaFractionMax: number; // cap total child area vs parent area (0–1)
    childPlacementScale: number; // e.g., 0.85 to place in the inner 85%
    minPixelRadius: number; // visibility threshold in screen px
    blobSpacing: number;
    maxDepth: number; // hard recursion cap
    segments: number; // base polygon segment count
}

/** Internal blob node */
interface BlobNode {
    id: string;
    level: number;
    parentId?: string;
    cx: number;
    cy: number;
    radius: number; // base radius before boundary jitter
    bbox: BBox; // simple axis-aligned, center±radius
    generatedChildren: boolean;
    children: BlobNode[];
    color: number;
}

/* -------------------------------------------------- */
/* Public API                                          */
/* -------------------------------------------------- */

const MAX_PLACEMENT_ATTEMPTS = 50;
/**
 * Create the fractal landmarks context. Place `ctx.container` inside your world container at z=0.
 */
export function createFractalLandmarks(seed = 1): FractalLandmarksContext {
    const fullConfig: FractalConfig = {
        rootCount: 5,
        rootRadiusRange: [8e9, 16e9],
        childRadiusFrac: [0.1, 0.15],
        childCountRange: [6, 9],
        childAreaFractionMax: 0.45,
        childPlacementScale: 0.85,
        blobSpacing: 1.1,
        minPixelRadius: 2,
        maxDepth: 100,
        segments: 50,
    };

    const container = new Container();
    container.sortableChildren = true;

    const nodes = new Map<string, BlobNode>();
    const gfx = new Map<string, Graphics>();

    // Deterministically scatter root blobs around origin.
    const roots: BlobNode[] = [];
    const rootRng = makeRng(seed);

    // --- CORRECTED ROOT GENERATION LOOP ---
    for (let i = 0; i < fullConfig.rootCount; i++) {
        // 1. Move the `node` declaration inside the loop for correct scope
        let node: BlobNode | null = null;

        // 2. Add the missing retry loop for placement
        for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
            const r = lerp(fullConfig.rootRadiusRange[0], fullConfig.rootRadiusRange[1], rootRng());
            let cx: number;
            let cy: number;

            if (i === 0) {
                cx = 0;
                cy = 0;
            } else {
                const theta = rootRng() * Math.PI * 2;
                const dist = r * (1.5 + rootRng() * 2.5);
                cx = Math.cos(theta) * dist;
                cy = Math.sin(theta) * dist;
            }

            // 3. Perform collision check against ALL existing roots first
            let isColliding = false;
            for (const otherRoot of roots) {
                const requiredDist = (r + otherRoot.radius) * fullConfig.blobSpacing;
                if (distance(cx, cy, otherRoot.cx, otherRoot.cy) < requiredDist) {
                    isColliding = true;
                    break; // Collision found, break this inner loop and retry
                }
            }

            // 4. ONLY if no collisions were found, create the node and break the retry loop
            if (!isColliding) {
                node = {
                    id: `L0_${i}`,
                    level: 0,
                    cx,
                    cy,
                    radius: r,
                    bbox: { x: cx - r, y: cy - r, width: r * 2, height: r * 2 },
                    generatedChildren: false,
                    children: [],
                    color: COLOR_EVEN,
                };
                break; // Success! Exit the `attempt` loop.
            }
        } // End of retry loop

        // Add the successfully created node (if any) to our collections
        if (node) {
            nodes.set(node.id, node);
            roots.push(node);
        } else {
            // This now correctly reports if a blob couldn't be placed
            console.warn(`Could not place root blob ${i} after ${MAX_PLACEMENT_ATTEMPTS} attempts.`);
        }
    }

    return {
        container,
        seed,
        roots,
        nodes,
        gfx,
        config: fullConfig,
    };
}

/**
 * Call every frame (before drawing strokes).
 * @param ctx context from createFractalLandmarks
 * @param viewRect current visible world rectangle
 * @param worldZoom effective world→screen scale (world units * worldZoom = pixels)
 */
export function updateFractalLandmarks(ctx: FractalLandmarksContext, viewRect: BBox, worldZoom: number) {
    const { container, roots, config, nodes, gfx } = ctx;

    const minWorldRadius = config.minPixelRadius / worldZoom;

    const visibleIds = new Set<string>();

    // Traverse each root
    for (const root of roots) {
        visitNode(root, ctx);
    }

    // Hide / prune graphics not in the visible set
    for (const [id, g] of gfx) {
        g.visible = visibleIds.has(id);
    }

    /* -------- traversal ---------- */
    function visitNode(node: BlobNode, ctx: FractalLandmarksContext) {
        if (!intersects(node.bbox, viewRect)) return;
        if (node.radius < minWorldRadius) return;

        visibleIds.add(node.id);

        // Ensure graphics exists & up to date
        ensureGraphics(node, ctx);

        // Generate children if allowed & not yet generated
        if (node.level < config.maxDepth && !node.generatedChildren && node.radius * config.childRadiusFrac[0] > minWorldRadius) {
            generateChildren(node, ctx);
        }

        // Recurse
        for (const child of node.children) {
            visitNode(child, ctx);
        }
    }
}

/* -------------------------------------------------- */
/* Generation helpers                                  */
/* -------------------------------------------------- */

// const COLOR_EVEN = 0x0f2e1b; // green
const COLOR_EVEN = 0x04150c; // green
const COLOR_ODD = 0x000000; // black

function generateChildren(parent: BlobNode, ctx: FractalLandmarksContext) {
    const { config, seed, nodes } = ctx;
    const rng = makeNodeRng(seed, parent);

    const [minFrac, maxFrac] = config.childRadiusFrac;
    const [minCount, maxCount] = config.childCountRange;
    const targetCount = randInt(rng, minCount, maxCount);
    const maxArea = Math.PI * parent.radius * parent.radius * config.childAreaFractionMax;

    let usedArea = 0;
    let produced = 0;
    let attempts = 0;

    while (produced < targetCount && attempts < targetCount * 10) {
        attempts++;

        const frac = lerp(minFrac, maxFrac, rng());
        const r = parent.radius * frac;

        // radial placement inside parent disk minus child radius
        const theta = rng() * Math.PI * 2;
        const maxCenterDist = Math.max(0, parent.radius - r);
        const dist = rng() * maxCenterDist * config.childPlacementScale;
        const cx = parent.cx + Math.cos(theta) * dist;
        const cy = parent.cy + Math.sin(theta) * dist;

        // simple containment (circle inside circle)
        if (distance(cx, cy, parent.cx, parent.cy) + r > parent.radius) continue;

        const area = Math.PI * r * r;
        if (usedArea + area > maxArea) break;

        const level = parent.level + 1;
        const id = `${parent.id}_${produced}`;
        const node: BlobNode = {
            id,
            level,
            parentId: parent.id,
            cx,
            cy,
            radius: r,
            bbox: {
                x: cx - r,
                y: cy - r,
                width: r * 2,
                height: r * 2,
            },
            generatedChildren: false,
            children: [],
            color: level % 2 === 0 ? COLOR_EVEN : COLOR_ODD,
        };
        parent.children.push(node);
        nodes.set(id, node);
        usedArea += area;
        produced++;
    }

    parent.generatedChildren = true;
}

/* -------------------------------------------------- */
/* Graphics / shape generation                         */
/* -------------------------------------------------- */

function makeNodePolygon(rng: () => number, radius: number, segments: number) {
    const pts: [number, number][] = [];
    for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        // jitter ~ ±20%
        const jitter = 0.8 + rng() * 0.2;
        const rr = radius * jitter;
        pts.push([Math.cos(t) * rr, Math.sin(t) * rr]);
    }
    return pts;
}

function ensureGraphics(node: BlobNode, ctx: FractalLandmarksContext) {
    const { container, gfx, config } = ctx;

    let g = gfx.get(node.id);
    if (!g) {
        g = new Graphics();
        gfx.set(node.id, g);
        container.addChild(g);
    }
    // Draw only if first time or we could adapt smoothing per zoom (optional).
    if ((g as any)._drawn) {
        g.visible = true;
        return;
    }

    g.clear();
    g.x = node.cx;
    g.y = node.cy;
    // deterministic boundary jitter from node id
    const rng = makeStringRng(node.id);
    const pts = makeNodePolygon(rng, node.radius, config.segments);

    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fill({ color: node.color, alpha: 1.0 });

    // Z-order by level (coarse under fine)
    g.zIndex = node.level;

    (g as any)._drawn = true;
    g.visible = true;

    // Stash static references for reuse
    return g;
}

/* -------------------------------------------------- */
/* RNG / math helpers                                  */
/* -------------------------------------------------- */

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}
function distance(x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1,
        dy = y2 - y1;
    return Math.hypot(dx, dy);
}

function makeRng(seed: number) {
    // Mulberry32
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashString(str: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function makeStringRng(str: string) {
    return makeRng(hashString(str));
}

function makeNodeRng(globalSeed: number, node: BlobNode) {
    return makeRng(hashString(node.id + "#" + globalSeed));
}

function randInt(rng: () => number, min: number, max: number) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

function intersects(a: BBox, b: BBox) {
    return !(a.x + a.width < b.x || a.x > b.x + b.width || a.y + a.height < b.y || a.y > b.y + b.height);
}
