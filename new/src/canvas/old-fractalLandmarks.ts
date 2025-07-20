// fractalLandmarks.ts

import { Application, Container, Graphics, Rectangle } from "pixi.js";
import { BBox } from "./canvas";

export const fractalLandmarks = new Container();

const bgTileCache = new Map<string, Graphics>(); // key: `${scale}:${cx}:${cy}`

function hash32(x: number, y: number, s: number) {
    // 32-bit integer hash (Thomas Wang style)
    let h = x * 374761393 + y * 668265263 + s * 2147483647;
    h = (h ^ (h >> 13)) * 1274126177;
    return (h ^ (h >> 16)) >>> 0;
}
function rng(seed: number) {
    // mulberry32
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// --- Parity-based alternating fractal pattern ---

function makeBlob(g: Graphics, cx: number, cy: number, r: number, seed: number, color: number, alpha: number) {
    const rand = rng(seed);
    const points: [number, number][] = [];
    const steps = 32; // radial samples
    for (let i = 0; i < steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const jitter = 0.55 + rand() * 0.9; // radial irregularity
        const rr = r * jitter;
        points.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
    }
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.closePath();
    g.fill({ color, alpha });
}

interface TileSpec {
    scale: number; // integer scale index
    cx: number; // cell coordinate
    cy: number;
}

const GREEN = 0x0f2e1b;
const BLACK = 0x000000;
function getTile(scale: number, cx: number, cy: number): Graphics {
    const key = `${scale}:${cx}:${cy}`;
    let g = bgTileCache.get(key);
    if (g) return g;

    g = new Graphics();
    bgTileCache.set(key, g);

    const baseSize = 256; // world units
    const cellSize = baseSize * 2 ** scale;
    const seedBase = hash32(cx, cy, scale);
    const rand = rng(seedBase);

    // Position the graphics at cell origin to keep numbers small
    const originX = cx * cellSize;
    const originY = cy * cellSize;

    const isGreenScale = scale % 2 === 0;

    const blobCount = isGreenScale
        ? 1 + Math.floor(rand() * 2) // 1–2
        : 1 + Math.floor(rand() * 3); // 1–3 (a few more holes)

    const rMin = isGreenScale ? 0.35 : 0.15;
    const rMax = isGreenScale ? 0.55 : 0.35;

    const bkgColor = isGreenScale ? GREEN : BLACK;
    const alpha = 1.0; // opaque so holes overwrite masses

    let drewOdd = false;
    let lastScale = -1;

    for (let i = 0; i < blobCount; i++) {
        if (scale % 2 === 1) drewOdd = true;
        lastScale = scale;
        // Blob center inside cell (biased toward centre for landmarks)
        const bx = originX + (0.2 + 0.6 * rand()) * cellSize;
        const by = originY + (0.2 + 0.6 * rand()) * cellSize;
        // Radius relative to cell size; smaller at finer scales
        const r = (rMin + (rMax - rMin) * rand()) * cellSize;

        makeBlob(g, bx - originX, by - originY, r, seedBase + i * 9973, bkgColor, alpha);
    }

    if (!drewOdd && lastScale >= 0) {
        const forced = lastScale + 1;
        if (forced < 16) {
            // safety cap
            const cellSize = baseSize * 2 ** forced;
            const x0 = Math.floor(viewRect.x / cellSize);
            const y0 = Math.floor(viewRect.y / cellSize);
            for (let cx = x0 - 1; cx <= x0 + 1; cx++) {
                for (let cy = y0 - 1; cy <= y0 + 1; cy++) {
                    const key = `${forced}:${cx}:${cy}`;
                    if (!bgTileCache.has(key)) {
                        const tileG = getTile(forced, cx, cy);
                        fractalLandmarks.addChild(tileG);
                    }
                }
            }
        }
    }

    // Translate graphics so its local (0,0) sits at originX/Y
    g.x = originX;
    g.y = originY;

    return g;
}

export function updatefractalLandmarks(viewRect: BBox, worldZoom: number) {
    const baseSize = 256;
    const minScreenCell = 32; // don’t draw cells that would be smaller than this
    const maxScreenCell = window.innerWidth * 2; // skip cells too huge (optional)

    const tilesToShow: string[] = [];

    for (let scale = 0; scale < 10; scale++) {
        // adjust 10 as needed
        const cellSize = baseSize * 2 ** scale;
        const screenCell = cellSize * worldZoom;
        if (screenCell < minScreenCell) continue; // too fine
        if (screenCell > maxScreenCell) break; // beyond useful coarse layer

        // Compute cell index range overlapping the viewport
        const x0 = Math.floor(viewRect.x / cellSize);
        const y0 = Math.floor(viewRect.y / cellSize);
        const x1 = Math.floor((viewRect.x + viewRect.width) / cellSize);
        const y1 = Math.floor((viewRect.y + viewRect.height) / cellSize);

        for (let cx = x0 - 1; cx <= x1 + 1; cx++) {
            for (let cy = y0 - 1; cy <= y1 + 1; cy++) {
                const key = `${scale}:${cx}:${cy}`;
                tilesToShow.push(key);
                if (!bgTileCache.has(key)) {
                    const tileG = getTile(scale, cx, cy);
                    fractalLandmarks.addChild(tileG);
                }
            }
        }
    }

    // (Optional) prune far-away tiles to keep memory bounded
    if (bgTileCache.size > 500) {
        for (const [key, g] of bgTileCache) {
            if (!tilesToShow.includes(key)) {
                g.destroy();
                bgTileCache.delete(key);
            }
        }
    }
}
