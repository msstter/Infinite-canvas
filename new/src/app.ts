// main.ts
import { Application, Container, Graphics } from "pixi.js";
import { Quadtree, Rectangle } from "@timohausmann/quadtree-ts";
import Dexie, { Table } from "dexie";

// ─── 1.  Draw init ────────────────────────────────────────────────────────────
console.log("script loaded");
type DrawState = {
    active: boolean;
    pointerID: number;
    pts: PointTuple[];
    g: Graphics | null;
    width: number;
    color: number;
};

const initDrawState = (): DrawState => ({
    active: false,
    pointerID: -1,
    pts: [] as PointTuple[],
    g: null as Graphics | null,
    width: 2,
    color: 0x0088ff,
});

type DrawApp = {
    app: Application;
    world: Container;
    strokeCache: Map<string, Graphics>;
    drawState: DrawState;
};

async function initDraw(): Promise<DrawApp> {
    const app = new Application(); // ← no renderer yet!
    await app.init({ resizeTo: window, antialias: true });

    document.body.appendChild(app.canvas);

    app.canvas.style.touchAction = "none"; // prevent page‑scroll / pinch‑zoom
    const world = new Container(); // <- everything lives here
    app.stage.addChild(world);

    return {
        app,
        world,
        strokeCache: new Map(),
        drawState: initDrawState(),
    };
}

// ─── 2.  Stroke model & DB ───────────────────────────────────────────────────
type Point = { x: number; y: number };
type PointTuple = [x: number, y: number];

export interface StrokeData {
    id: string;
    pts: PointTuple[]; // polyline in world coords
    stroke: {
        width: number; // world‑unit thickness
        color: number; // 0xRRGGBB
    };
}

type BBox = { x: number; y: number; width: number; height: number };

// Has .data property with StrokeData
export interface StrokeRect extends Rectangle<StrokeData> {
    data: StrokeData;
}

// We need this wrapper to ensure that the data property is not optional.
// It also adds the id to the root object which is reqired by dexie.
const StrokeRect = (s: BBox & { data: StrokeData }): StrokeRect => Object.assign(new Rectangle(s), { id: s.data.id }) as StrokeRect;

class CanvasDB extends Dexie {
    strokes!: Table<StrokeRect, string>;
    constructor() {
        super("canvas");
        this.version(1).stores({ strokes: "id" }); // primary key only
    }
}
const db = new CanvasDB();

// ─── 3.  Spatial index ───────────────────────────────────────────────────────
const QT_BOUNDS: BBox = new Rectangle({ x: -1e6, y: -1e6, width: 2e6, height: 2e6 });
const tree = new Quadtree<StrokeRect>(QT_BOUNDS);

// on startup pull strokes from IndexedDB into the quadtree
(async () => {
    const all = await db.strokes.toArray();
    for (const s of all) tree.insert(s);
})();

// ─── 4.  Camera / interaction ────────────────────────────────────────────────
let zoom = 1;
function screenToWorld(x: number, y: number, draw: DrawApp) {
    const inv = 1 / zoom;
    return { x: (x - draw.world.x) * inv, y: (y - draw.world.y) * inv };
}

function initListeners(draw: DrawApp) {
    const { world, drawState, strokeCache } = draw;
    window.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const { x, y } = screenToWorld(e.clientX, e.clientY, draw);

            zoom = Math.min(Math.max(zoom * factor, 0.01), 100);
            world.scale.set(zoom);

            // keep the zoom centre fixed
            world.x = e.clientX - x * zoom;
            world.y = e.clientY - y * zoom;
        },
        { passive: false }
    );

    window.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;

        drawState.active = true;
        drawState.pointerID = e.pointerId;
        drawState.pts = [];
        const wPt = screenToWorld(e.clientX, e.clientY, draw);
        drawState.pts.push([wPt.x, wPt.y]);

        drawState.g = new Graphics();
        strokeCache.set("temp", drawState.g);
        world.addChild(drawState.g);

        // capture so we keep getting move events even if the finger leaves canvas
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    });
    window.addEventListener(
        "pointermove",
        (e) => {
            if (!drawState.active || e.pointerId !== drawState.pointerID) return;

            const wPt = screenToWorld(e.clientX, e.clientY, draw);
            const last = drawState.pts[drawState.pts.length - 1];
            // add a point only if we moved > 1 world unit
            if (Math.hypot(wPt.x - last[0], wPt.y - last[1]) < 1 / zoom) return;

            drawState.pts.push([wPt.x, wPt.y]);

            drawStroke(
                drawState.g!,
                StrokeRect({
                    // dummy rectangle for live preview
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    data: {
                        id: "temp",
                        pts: drawState.pts,
                        stroke: { width: drawState.width, color: drawState.color },
                    },
                }),
                zoom
            );
        },
        { passive: false } // IMPORTANT: stops touch scrolling while drawing
    );

    function finishStroke() {
        if (!drawState.active || drawState.pts.length < 2) {
            drawState.active = false;
            return;
        }

        const id = crypto.randomUUID();
        const data: StrokeData = {
            id,
            pts: drawState.pts,
            stroke: { width: drawState.width, color: drawState.color },
        };

        // bounding box (+margin)
        const xs = drawState.pts.map((p) => p[0]);
        const ys = drawState.pts.map((p) => p[1]);
        const minX = Math.min(...xs),
            maxX = Math.max(...xs);
        const minY = Math.min(...ys),
            maxY = Math.max(...ys);
        const margin = drawState.width / 2;

        const rect = StrokeRect({
            x: minX - margin,
            y: minY - margin,
            width: maxX - minX + drawState.width,
            height: maxY - minY + drawState.width,
            data,
        });

        // turn the “temp” graphics permanent
        if (drawState.g) {
            strokeCache.delete("temp");
            strokeCache.set(id, drawState.g);
        }
        tree.insert(rect);
        db.strokes.put(rect); // async save

        drawState.active = false;
    }

    window.addEventListener("pointerup", (e) => {
        if (e.pointerId === drawState.pointerID) finishStroke();
    });
    window.addEventListener("pointercancel", finishStroke);
}
// ─── 5.  Stroke drawing helper ───────────────────────────────────────────────
function drawStroke(g: Graphics & { lastZoom?: number }, rect: StrokeRect, z: number) {
    if (rect.data.id !== "temp" && g.lastZoom === z) return;
    // don’t redo identical work

    const s = rect.data;
    g.clear();

    g.moveTo(...s.pts[0]);
    for (let i = 1; i < s.pts.length; i++) g.lineTo(...s.pts[i]);

    const scaledStrokeWidth = s.stroke.width * (1 / z);

    if (g.lastZoom !== zoom) {
        console.log("zoom level", z);
        console.log("calculated stroke width", scaledStrokeWidth);
    }

    g.stroke({ width: scaledStrokeWidth, color: s.stroke.color });
    g.lastZoom = z; // remember what zoom we used
}

// ─── 6.  Render loop with quadtree culling ───────────────────────────────────

function renderLoop(draw: DrawApp) {
    const { app, world, strokeCache } = draw;
    app.ticker.add(() => {
        const viewW = app.renderer.width / zoom;
        const viewH = app.renderer.height / zoom;
        const viewRect = new Rectangle({
            x: -world.x / zoom,
            y: -world.y / zoom,
            width: viewW,
            height: viewH,
        });

        const visible = tree.retrieve(viewRect);
        // hide everything, then show only visible
        strokeCache.forEach((g, id) => {
            if (id !== "temp") g.visible = false; // don’t hide the live stroke preview
        });

        for (const rect of visible) {
            const s = rect.data;
            let g = strokeCache.get(s.id);
            if (!g) {
                g = new Graphics();
                strokeCache.set(s.id, g);
                world.addChild(g);
            }
            drawStroke(g, rect, zoom);
            g.visible = true;
        }
    });
}

function initApp() {
    initDraw().then((draw) => {
        initListeners(draw);
        renderLoop(draw);
    });
}

window.onload = initApp;
