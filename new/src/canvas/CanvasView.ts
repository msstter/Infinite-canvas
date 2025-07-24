// canvas/canvasView.ts
import { Application, Container, Graphics, Rectangle, ApplicationOptions } from "pixi.js";
import { DrawingModel } from "../DrawingData/DrawingModel";
import { createFractalLandmarks, updateFractalLandmarks, FractalLandmarksContext, centerFractal } from "./fractalLandmarks";
import { StrokeData, BBox, StrokeProperties, CanvasViewOptions, QuadItem, getQuadItem, isStroke, Zoom, CanvasTool, isTextCard, colorPallet } from "./types";
import { ActiveTool, appStore } from "../appState";
import { TextCardTool } from "./canvasTools/TextCardTool";
import { blockDrawingEvent, DrawTool } from "./canvasTools/DrawTool";
import { getCanvasTool } from "./canvasTools/getCanvasTool";
import { NotecardOverlay } from "../Notecard/notecardOverlay";

type DrawState = {
    frozen: boolean;
    active: boolean;
    pointerID: number;
    pts: [number, number][];
    g: Graphics | null;
    width: number;
    color: number;
};

const getPixiOptions = (targetElement: HTMLElement, options: Partial<CanvasViewOptions>) => {
    const pixiOptions: Partial<import("pixi.js").ApplicationOptions> = {
        antialias: true,
        backgroundColor: colorPallet.peony,
    };

    if (options.mainCanvas) {
        // Option 1: Fullscreen mode.
        // This makes the canvas renderer resize with the browser window.
        pixiOptions.resizeTo = window;
        console.log("CanvasView: Initializing in fullscreen mode.");
    } else if (options.width && options.height) {
        // Option 2: Fixed dimensions.
        pixiOptions.width = options.width;
        pixiOptions.height = options.height;
        console.log(`CanvasView: Initializing with fixed size ${options.width}x${options.height}.`);
    } else {
        // Option 3 (Default): Resize to the container element.
        // The user is responsible for styling the targetElement to have a size.
        pixiOptions.resizeTo = targetElement;
        console.log("CanvasView: Initializing to fill container element.");
    }
    return pixiOptions;
};

export class CanvasView {
    // --- Public Properties ---
    public readonly app: Application;
    public readonly model: DrawingModel;
    canvasTool: CanvasTool;
    options: Partial<CanvasViewOptions>;
    readonly world: Container;
    readonly strokeCache: Map<string, Graphics>;
    readonly fractalCtx: FractalLandmarksContext;

    // --- Private Camera State ---
    private zoomExp: number = -30;
    private localScale: number = 1;

    overlay: NotecardOverlay | null = null;
    // --- Interaction State ---
    drawState: DrawState;

    constructor(targetElement: HTMLElement, model: DrawingModel, options: Partial<CanvasViewOptions> = {}) {
        this.app = new Application();
        this.model = model;
        this.options = options;
        this.world = new Container();
        this.strokeCache = new Map();
        this.fractalCtx = createFractalLandmarks(12345); // optional seed

        this.canvasTool = new DrawTool(this);
        this.drawState = {
            frozen: false,
            active: false,
            pointerID: -1,
            pts: [],
            g: null,
            width: 2,
            color: colorPallet.seafoam,
        };

        // This is an async constructor pattern. We run the async setup
        // and then kick off listeners and rendering.
        this._init(targetElement, options);
    }

    private async _init(targetElement: HTMLElement, options: Partial<CanvasViewOptions>) {
        await this.app.init(getPixiOptions(targetElement, options));

        this.app.canvas.classList.add(options.mainCanvas ? "main-canvas" : "sub-canvas");
        targetElement.appendChild(this.app.canvas);

        this.app.canvas.style.touchAction = "none"; // prevent page-scroll / pinch-zoom

        this.app.stage.addChild(this.world);
        this.world.addChildAt(this.fractalCtx.container, 0); // background under strokes
        this.world.scale.set(this.getZoom());
        this.world.x = this.app.renderer.width * 0.5;
        this.world.y = this.app.renderer.height * 0.5;
        // centerFractal(this.fractalCtx, this.app.renderer);
        this._initListeners(options);
        this.overlay = new NotecardOverlay(this);
        this.overlay.init();
        this._startRenderLoop();

        // When activeTool appState is updated, set the tool active in every canvas. Note this means that different tools cannot be active in different canvases. For now that's the behaivior we want.
        appStore.subscribe(
            (s) => s.activeTool,
            (tool) => getCanvasTool(this, tool) // Note that sub-canvases will have empty tools (no pointer events)
        );
    }

    getZoomObj(): Zoom {
        return { zoomExp: this.zoomExp, localScale: this.localScale };
    }
    /** Attaches all event listeners for this specific canvas view. */
    private _initListeners(options: Partial<CanvasViewOptions>): void {
        const canvas: HTMLElement = options.mainCanvas ? document.body : this.app.canvas;

        canvas.addEventListener(
            "wheel",
            (e) => {
                e.preventDefault();
                if (options.mainCanvas === false) e.stopPropagation();
                if (this.drawState.frozen) return;
                if (e.target && blockDrawingEvent(e.target as HTMLElement, options.mainCanvas ?? false)) return;
                const localCoords = this.getLocalCoordsFromEvent(e);
                const worldPoint = this.screenToWorld(localCoords.x, localCoords.y);

                this._updateZoom(e.deltaY);
                const newZoom = this.getZoom();

                this.world.scale.set(newZoom);
                this.world.x = e.clientX - worldPoint.x * newZoom;
                this.world.y = e.clientY - worldPoint.y * newZoom;
            },
            { passive: false }
        );

        canvas.addEventListener("pointerdown", (e) => {
            this.canvasTool.pointerDown(e);
        });

        canvas.addEventListener(
            "pointermove",
            (e) => {
                this.canvasTool.pointerMove(e);
            },
            { passive: false }
        );

        canvas.addEventListener("pointerup", (e) => {
            this.canvasTool.pointerUp(e);
        });
        canvas.addEventListener("pointercancel", (e) => {
            this.canvasTool.pointerUp(e);
        });
    }

    getLocalCoordsFromEvent(event: { clientX: number; clientY: number }): { x: number; y: number } {
        const rect = this.app.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }
    /** Starts the PIXI ticker for continuous rendering. */
    private _startRenderLoop(): void {
        this.app.ticker.add(() => {
            this.overlay?.beginFrame();
            const viewRect = this.getViewRect();

            // Update background landmarks
            updateFractalLandmarks(this.fractalCtx, viewRect, this.getZoom());

            // Get only the strokes visible in this view's viewport from the shared model
            const visible = this.model.getVisibleItems(viewRect);

            // Hide all cached graphics except the live drawing one
            this.strokeCache.forEach((g, id) => {
                if (id !== "temp") g.visible = false;
            });

            // Draw and show the visible strokes
            for (const item of visible) {
                if (isStroke(item)) {
                    let g = this.strokeCache.get(item.id);
                    if (!g) {
                        g = new Graphics();
                        this.strokeCache.set(item.id, g);
                        this.world.addChild(g);
                    }
                    this.drawStroke(g, item, this.getZoom());
                    g.visible = true;
                } else if (isTextCard(item) && this.overlay) {
                    this.overlay.syncPosition(item);
                }
            }
            this.overlay?.endFrame();
        });
    }

    // --- Private Helpers (previously global functions) ---

    getZoom(): number {
        return this.localScale * Math.pow(2, this.zoomExp);
    }

    getScaledStroke(strokeWidth: number): number {
        return (strokeWidth / this.localScale) * Math.pow(2, -this.zoomExp);
    }

    private _updateZoom = (delta: number): void => {
        const factor = delta < 0 ? 1.1 : 0.9;
        this.localScale *= factor;

        while (this.localScale >= 2) {
            this.localScale /= 2;
            this.zoomExp++;
        }
        while (this.localScale < 0.5) {
            this.localScale *= 2;
            this.zoomExp--;
        }
    };

    screenToWorld(x: number, y: number): { x: number; y: number } {
        const inv = 1 / this.getZoom();
        return { x: (x - this.world.x) * inv, y: (y - this.world.y) * inv };
    }

    getViewRect(): BBox {
        const z = this.getZoom();
        return {
            x: -this.world.x / z,
            y: -this.world.y / z,
            width: this.app.renderer.width / z,
            height: this.app.renderer.height / z,
        };
    }

    drawStroke(g: Graphics & { lastZoom?: number }, rect: QuadItem<StrokeProperties>, z: number): void {
        if (rect.id !== "temp" && g.lastZoom === z) return;

        const s = rect.data;
        g.clear();
        g.moveTo(...s.pts[0]);
        for (let i = 1; i < s.pts.length; i++) g.lineTo(...s.pts[i]);
        g.stroke({ width: s.stroke.width, color: s.stroke.color });
        g.lastZoom = z;
    }
}
