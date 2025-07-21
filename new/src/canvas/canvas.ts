// canvas.ts
import { Application, Container, Graphics } from "pixi.js";
import { Quadtree, Rectangle } from "@timohausmann/quadtree-ts";
import Dexie, { Table } from "dexie";
import { createFractalLandmarks, updateFractalLandmarks, FractalLandmarksContext } from "./fractalLandmarks";

// ─── 1.  Draw init ────────────────────────────────────────────────────────────
console.log("script loaded");

type DrawState = {
    frozen: boolean;
    active: boolean;
    pointerID: number;
    pts: Point[];
    g: Graphics | null;
    width: number;
    color: number;
};

const initDrawState = (): DrawState => ({
    frozen: false,
    active: false,
    pointerID: -1,
    pts: [] as Point[],
    g: null as Graphics | null,
    width: 2,
    color: 0x0088ff,
});

export type DrawApp = {
    app: Application;
    world: Container;
    strokeCache: Map<string, Graphics>;
    tree: Quadtree<StrokeRect>;
    drawState: DrawState;
    fractalCtx: FractalLandmarksContext;
};

const initQuadtree = (): Quadtree<StrokeRect> => {
    // ─── 3.  Spatial index ───────────────────────────────────────────────────────
    const QT_BOUNDS: BBox = { x: -1e13, y: -1e13, width: 2e13, height: 2e13 };

    return new Quadtree<StrokeRect>(QT_BOUNDS);
};

export async function initDraw(): Promise<DrawApp> {
    const app = new Application(); // ← no renderer yet!
    await app.init({ resizeTo: window, antialias: true });

    document.body.appendChild(app.canvas);

    app.canvas.style.touchAction = "none"; // prevent page‑scroll / pinch‑zoom
    const world = new Container(); // <- everything lives here
    const fractalCtx = createFractalLandmarks(12345); // optional seed
    world.addChildAt(fractalCtx.container, 0); // background under strokes

    app.stage.addChild(world);
    world.scale.set(getZoom());

    return {
        app,
        world,
        strokeCache: new Map(),
        drawState: initDrawState(),
        tree: initQuadtree(),
        fractalCtx,
    };
}

// ─── 2.  Stroke model & DB ───────────────────────────────────────────────────

type Point = [x: number, y: number];

export interface StrokeData {
    pts: Point[]; // polyline in world coords
    stroke: {
        width: number; // world‑unit thickness
        color: number; // 0xRRGGBB
    };
}

export type BBox = { x: number; y: number; width: number; height: number };

// Has .data property with StrokeData
export interface StrokeRectProperties extends BBox {
    data: StrokeData;
    id: string;
}

export type StrokeRect = Rectangle<StrokeData> & StrokeRectProperties;

// We need this wrapper to ensure that the data property is not optional.
// It also adds the id to the root object which is reqired by dexie but not provided by pixi.
export const StrokeRect = (s: StrokeRectProperties): StrokeRect => Object.assign(new Rectangle(s), { id: s.id }) as StrokeRect;

export class CanvasDB extends Dexie {
    strokes!: Table<StrokeRect, string>;
    constructor() {
        super("canvas");
        this.version(1).stores({ strokes: "id" }); // primary key only
    }
}

export const initDB = (draw: DrawApp): CanvasDB => {
    const db = new CanvasDB();

    // on startup pull strokes from IndexedDB into the quadtree
    (async () => {
        const all = await db.strokes.toArray();
        for (const s of all) {
            const rect = StrokeRect(s);
            draw.tree.insert(rect);
        }
    })();
    return db;
};

function saveRect(db: CanvasDB, rect: StrokeRect) {
    const cleanRect = structuredClone(rect); // deep copy, no methods
    delete (cleanRect as any).qtIndex; // remove runtime cache
    db.strokes.put(cleanRect);
}

// Call this in the browser console to reset the canvas
export const clearDB = () => {
    Dexie.delete("canvas")
        .then(() => {
            location.reload(); // Reload page
            console.log("IndexedDB “canvas” deleted");
        })
        .catch(console.error);
};

// @ts-ignore
window.clearDB = clearDB; // us in browser inspector

// ─── 4.  Camera / interaction ────────────────────────────────────────────────

let zoomExp = -25; // integer power‑of‑2 exponent  … × 2^zoomExp
let localScale = 1; // stays in [0.5, 2)
const getZoom = () => localScale * Math.pow(2, zoomExp); // effective scale
const getZoomInv = () => (1 / localScale) * Math.pow(2, -zoomExp); // use for precie inverse

const getScaledStroke = (strokeWith: number) => (strokeWith / localScale) * Math.pow(2, -zoomExp);
const updateZoom = (delta: number, localScale: number, zoomExp: number): { localScale: number; zoomExp: number } => {
    // 10 % zoom per wheel “notch”
    const factor = delta < 0 ? 1.1 : 0.9;
    localScale = localScale * factor;

    // keep localScale in [0.5, 2) and
    // fold the overflow/underflow into the exponent
    while (localScale >= 2) {
        localScale = localScale / 2;
        zoomExp = zoomExp + 1;
    }
    while (localScale < 0.5) {
        localScale = localScale * 2;
        zoomExp = zoomExp - 1;
    }

    return { localScale, zoomExp };
};

function screenToWorld(x: number, y: number, draw: DrawApp) {
    const zoom = getZoom();
    const inv = 1 / zoom;
    return { x: (x - draw.world.x) * inv, y: (y - draw.world.y) * inv };
}

export function initListeners(draw: DrawApp, db: CanvasDB) {
    const { world, drawState, strokeCache } = draw;
    window.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            if (drawState.frozen) return;
            const { x, y } = screenToWorld(e.clientX, e.clientY, draw);

            const updatedZoom = updateZoom(e.deltaY, localScale, zoomExp);
            localScale = updatedZoom.localScale;
            zoomExp = updatedZoom.zoomExp;

            world.scale.set(getZoom());

            // keep the zoom centre fixed
            world.x = e.clientX - x * getZoom();
            world.y = e.clientY - y * getZoom();
        },
        { passive: false }
    );

    window.addEventListener("pointerdown", (e) => {
        if (drawState.frozen) return;
        if (e.button !== 0 && e.pointerType === "mouse") return;
        if ((e.target as HTMLElement).closest("button")) return;
        drawState.active = true;
        drawState.pointerID = e.pointerId;
        drawState.pts = [];
        const worldPoint = screenToWorld(e.clientX, e.clientY, draw);
        drawState.pts.push([worldPoint.x, worldPoint.y]);

        drawState.g = new Graphics();
        strokeCache.set("temp", drawState.g);
        world.addChild(drawState.g);

        // capture so we keep getting move events even if the finger leaves canvas
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    });
    window.addEventListener(
        "pointermove",
        (e) => {
            if (drawState.frozen || !drawState.active || e.pointerId !== drawState.pointerID) return;

            const worldPoint = screenToWorld(e.clientX, e.clientY, draw);
            const last = drawState.pts[drawState.pts.length - 1];
            // add a point only if we moved > 1 world unit
            if (Math.hypot(worldPoint.x - last[0], worldPoint.y - last[1]) < 1 / getZoom()) return;

            drawState.pts.push([worldPoint.x, worldPoint.y]);

            drawStroke(
                drawState.g!,
                StrokeRect({
                    // dummy rectangle for live preview
                    id: "temp",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    data: {
                        pts: drawState.pts,
                        stroke: { width: getScaledStroke(drawState.width), color: drawState.color },
                    },
                }),
                getZoom()
            );
        },
        { passive: false } // IMPORTANT: stops touch scrolling while drawing
    );

    function finishStroke() {
        if (drawState.g) {
            world.removeChild(drawState.g);
            strokeCache.delete("temp");
            drawState.g = null;
        }

        if (drawState.frozen || !drawState.active || drawState.pts.length < 2) {
            drawState.active = false;
            return;
        }

        const data: StrokeData = {
            pts: drawState.pts,
            stroke: { width: getScaledStroke(drawState.width), color: drawState.color },
        };

        // bounding box (+margin)
        const xs = drawState.pts.map((p) => p[0]);
        const ys = drawState.pts.map((p) => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const margin = getScaledStroke(drawState.width / 2);
        const scaledWidth = getScaledStroke(drawState.width);
        const uuid = crypto.randomUUID();
        const rect = StrokeRect({
            id: uuid,
            x: minX - margin,
            y: minY - margin,
            width: maxX - minX + scaledWidth,
            height: maxY - minY + scaledWidth,
            data,
        });

        draw.tree.insert(rect);
        saveRect(db, rect);

        drawState.active = false;
    }

    window.addEventListener("pointerup", (e) => {
        if (e.pointerId === drawState.pointerID) finishStroke();
    });
    window.addEventListener("pointercancel", finishStroke);
}
// ─── 5.  Stroke drawing helper ───────────────────────────────────────────────
function drawStroke(g: Graphics & { lastZoom?: number }, rect: StrokeRect, z: number) {
    if (rect.id !== "temp" && g.lastZoom === z) return;
    // don’t redo identical work

    const s = rect.data;
    g.clear();

    g.moveTo(...s.pts[0]);
    for (let i = 1; i < s.pts.length; i++) g.lineTo(...s.pts[i]);

    if (false && g.lastZoom !== getZoom()) {
        console.log("zoom level", z);
        console.log("calculated stroke width", s.stroke.width);
    }

    g.stroke({ width: s.stroke.width, color: s.stroke.color });
    g.lastZoom = z; // remember what zoom we used
}

// ─── 6.  Render loop with quadtree culling ───────────────────────────────────

function getViewRect(app: Application, world: Container): BBox {
    const z = getZoom();
    return new Rectangle({
        x: -world.x / z,
        y: -world.y / z,
        width: app.renderer.width / z,
        height: app.renderer.height / z,
    });
}

function getViewRectWithMargin(app: Application, world: Container, marginWorld: number): BBox {
    const z = getZoom();
    const base = getViewRect(app, world);
    return new Rectangle({
        x: base.x - marginWorld,
        y: base.y - marginWorld,
        width: base.width + 2 * marginWorld,
        height: base.height + 2 * marginWorld,
    });
}

export function renderLoop(draw: DrawApp) {
    const { app, world, strokeCache } = draw;
    app.ticker.add(() => {
        // const viewWithMargin = getViewRectWithMargin(app, world, 512);

        updateFractalLandmarks(draw.fractalCtx, getViewRect(app, world), getZoom());

        const viewW = app.renderer.width / getZoom();
        const viewH = app.renderer.height / getZoom();
        const viewRect = new Rectangle({
            x: -world.x / getZoom(),
            y: -world.y / getZoom(),
            width: viewW,
            height: viewH,
        });

        // This is the key step that uses the quad tree to determine which strokes are visible.
        const visible = draw.tree.retrieve(viewRect);

        // hide everything, then show only visible
        strokeCache.forEach((g, id) => {
            if (id !== "temp") g.visible = false; // don’t hide the live stroke preview
        });

        for (const rect of visible) {
            let g = strokeCache.get(rect.id);
            if (!g) {
                g = new Graphics();
                strokeCache.set(rect.id, g);
                world.addChild(g);
            }
            drawStroke(g, rect, getZoom());
            g.visible = true;
        }
    });
}
