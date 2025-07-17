// main.ts
import { Application, Container, Graphics } from "pixi.js";
import { Quadtree, Rectangle } from "@timohausmann/quadtree-ts";
import Dexie, { Table } from "dexie";

// ─── 1.  Pixi init ────────────────────────────────────────────────────────────

async function initPixi() {
    const app = new Application(); // ← no renderer yet!
    await app.init({ resizeTo: window, antialias: true });

    document.body.appendChild(app.canvas);

    const world = new Container(); // <- everything lives here
    app.stage.addChild(world);
    return [app, world] as const;
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

// Has .data property with StrokeData
export interface StrokeRect extends Rectangle<StrokeData> {
    data: StrokeData;
}

class CanvasDB extends Dexie {
    strokes!: Table<StrokeRect, string>;
    constructor() {
        super("canvas");
        this.version(1).stores({ strokes: "id" }); // primary key only
    }
}
const db = new CanvasDB();

// ─── 3.  Spatial index ───────────────────────────────────────────────────────
const QT_BOUNDS: Rectangle = new Rectangle({ x: -1e6, y: -1e6, width: 2e6, height: 2e6 });
const tree = new Quadtree<StrokeRect>(QT_BOUNDS);

// on startup pull strokes from IndexedDB into the quadtree
(async () => {
    const all = await db.strokes.toArray();
    for (const s of all) tree.insert(s);
})();

// ─── 4.  Camera / interaction ────────────────────────────────────────────────
let zoom = 1;
function screenToWorld(x: number, y: number, world: Container) {
    const inv = 1 / zoom;
    return { x: (x - world.x) * inv, y: (y - world.y) * inv };
}

function initListeners(world: Container) {
    window.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            const { x, y } = screenToWorld(e.clientX, e.clientY, world);

            zoom = Math.min(Math.max(zoom * factor, 0.01), 100);
            world.scale.set(zoom);

            // keep the zoom centre fixed
            world.x = e.clientX - x * zoom;
            world.y = e.clientY - y * zoom;
        },
        { passive: false }
    );

    let dragging = false,
        lastX = 0,
        lastY = 0;
    window.addEventListener("pointerdown", (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });
    window.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        world.x += e.clientX - lastX;
        world.y += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
    });
    window.addEventListener("pointerup", () => (dragging = false));
}
// ─── 5.  Stroke drawing helper ───────────────────────────────────────────────
function drawStroke(g: Graphics, rect: StrokeRect) {
    const s = rect.data;
    g.clear();
    g.lineStyle(rect.width, s.stroke.color);
    g.moveTo(...s.pts[0]);
    for (let i = 1; i < s.pts.length; i++) g.lineTo(...s.pts[i]);
}

// ─── 6.  Render loop with quadtree culling ───────────────────────────────────

function renderLoop(app: Application, world: Container) {
    const strokeCache = new Map<string, Graphics>();

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
        strokeCache.forEach((g) => (g.visible = false));

        for (const rect of visible) {
            const s = rect.data;
            let g = strokeCache.get(s.id);
            if (!g) {
                g = new Graphics();
                strokeCache.set(s.id, g);
                world.addChild(g);
                drawStroke(g, rect);
            }
            g.visible = true;
        }
    });
}

function init(app: Application, world: Container) {
    initPixi().then(([app, world]) => {
        initListeners(world);
    });
}
