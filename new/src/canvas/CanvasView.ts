// canvas/canvasView.ts
import { Application, Container, Graphics, Rectangle, ApplicationOptions } from "pixi.js";
import { DrawingModel } from "../DrawingData/DrawingModel";
import { createFractalLandmarks, updateFractalLandmarks, FractalLandmarksContext } from "./fractalLandmarks";
import { StrokeData, StrokeRect, BBox, StrokeRectProperties, CanvasViewOptions } from "./types";

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

const blockDrawingEvent = (target: HTMLElement, mainCanvas: boolean) => {
    // If the target is in a parent that is a button, notecard, or sub-canvas
    let result: boolean;
    if (mainCanvas) {
        result = !!target.closest("button,.notecard,.sub-canvas");
    } else {
        result = false;
    }
    console.log("block drawing in", result, target);
    return result;
};

export class CanvasView {
    // --- Public Properties ---
    public readonly app: Application;
    public readonly model: DrawingModel;

    // --- Private View-Specific State ---
    private readonly world: Container;
    private readonly strokeCache: Map<string, Graphics>;
    private readonly fractalCtx: FractalLandmarksContext;

    // --- Private Camera State ---
    private zoomExp = -25;
    private localScale = 1;

    // --- Interaction State ---
    // TODO: Maybe this should be made private in the future.
    drawState: DrawState;

    constructor(targetElement: HTMLElement, model: DrawingModel, options: Partial<CanvasViewOptions> = {}) {
        this.app = new Application();
        this.model = model;
        this.world = new Container();
        this.strokeCache = new Map();
        this.fractalCtx = createFractalLandmarks(12345); // optional seed

        this.drawState = {
            frozen: false,
            active: false,
            pointerID: -1,
            pts: [],
            g: null,
            width: 2,
            color: 0x0088ff,
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
        this.world.scale.set(this._getZoom());

        this._initListeners(options);
        this._startRenderLoop();

        // Subscribe this view to the shared model's updates
        // this.model.store.subscribe(
        //     (state) => state.revision,
        //     () => {
        //         // When the model changes, the render loop will automatically pick it up.
        //         // For a non-continuous render loop, you would manually trigger a render here.
        //         // e.g., this.app.render();
        //         console.log("View received update from model. A re-render will occur.");
        //     }
        // );
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
                const localCoords = this._getLocalCoordsFromEvent(e);
                const worldPoint = this._screenToWorld(localCoords.x, localCoords.y);

                this._updateZoom(e.deltaY);
                const newZoom = this._getZoom();

                this.world.scale.set(newZoom);
                this.world.x = e.clientX - worldPoint.x * newZoom;
                this.world.y = e.clientY - worldPoint.y * newZoom;
            },
            { passive: false }
        );

        canvas.addEventListener("pointerdown", (e) => {
            if (options.mainCanvas === false) e.stopPropagation();
            if (this.drawState.frozen || (e.button !== 0 && e.pointerType === "mouse")) return;
            if (e.target && blockDrawingEvent(e.target as HTMLElement, options.mainCanvas ?? false)) return;

            this.drawState.active = true;
            this.drawState.pointerID = e.pointerId;
            this.drawState.pts = [];
            const localCoords = this._getLocalCoordsFromEvent(e);
            const worldPoint = this._screenToWorld(localCoords.x, localCoords.y);

            this.drawState.pts.push([worldPoint.x, worldPoint.y]);

            this.drawState.g = new Graphics();
            this.strokeCache.set("temp", this.drawState.g);
            this.world.addChild(this.drawState.g);

            canvas.setPointerCapture(e.pointerId);
        });

        canvas.addEventListener(
            "pointermove",
            (e) => {
                if (options.mainCanvas === false) e.stopPropagation();
                if (this.drawState.frozen || !this.drawState.active || e.pointerId !== this.drawState.pointerID) return;
                if (e.target && blockDrawingEvent(e.target as HTMLElement, options.mainCanvas ?? false)) return;
                const localCoords = this._getLocalCoordsFromEvent(e);
                const worldPoint = this._screenToWorld(localCoords.x, localCoords.y);

                const last = this.drawState.pts[this.drawState.pts.length - 1];
                if (Math.hypot(worldPoint.x - last[0], worldPoint.y - last[1]) < 1 / this._getZoom()) return;

                this.drawState.pts.push([worldPoint.x, worldPoint.y]);

                const tempRect = StrokeRect({
                    id: "temp",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    data: {
                        pts: this.drawState.pts,
                        stroke: { width: this._getScaledStroke(this.drawState.width), color: this.drawState.color },
                    },
                });
                this._drawStroke(this.drawState.g!, tempRect, this._getZoom());
            },
            { passive: false }
        );

        const finishStroke = () => {
            if (this.drawState.g) {
                this.world.removeChild(this.drawState.g);
                this.strokeCache.delete("temp");
                this.drawState.g = null;
            }

            if (this.drawState.frozen || !this.drawState.active || this.drawState.pts.length < 2) {
                this.drawState.active = false;
                return;
            }

            const data: StrokeData = {
                pts: this.drawState.pts,
                stroke: { width: this._getScaledStroke(this.drawState.width), color: this.drawState.color },
            };

            // This is the key interaction: the view asks the model to add the stroke.
            this.model.addStroke(data);

            this.drawState.active = false;
        };

        canvas.addEventListener("pointerup", (e) => {
            if (e.pointerId === this.drawState.pointerID) finishStroke();
        });
        canvas.addEventListener("pointercancel", finishStroke);
    }

    private _getLocalCoordsFromEvent(event: { clientX: number; clientY: number }): { x: number; y: number } {
        const rect = this.app.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }
    /** Starts the PIXI ticker for continuous rendering. */
    private _startRenderLoop(): void {
        this.app.ticker.add(() => {
            const viewRect = this._getViewRect();

            // Update background landmarks
            updateFractalLandmarks(this.fractalCtx, viewRect, this._getZoom());

            // Get only the strokes visible in this view's viewport from the shared model
            const visible = this.model.getVisibleStrokes(viewRect);

            // Hide all cached graphics except the live drawing one
            this.strokeCache.forEach((g, id) => {
                if (id !== "temp") g.visible = false;
            });

            // Draw and show the visible strokes
            for (const rect of visible) {
                let g = this.strokeCache.get(rect.id);
                if (!g) {
                    g = new Graphics();
                    this.strokeCache.set(rect.id, g);
                    this.world.addChild(g);
                }
                this._drawStroke(g, rect, this._getZoom());
                g.visible = true;
            }
        });
    }

    // --- Private Helpers (previously global functions) ---

    private _getZoom = (): number => this.localScale * Math.pow(2, this.zoomExp);

    private _getScaledStroke = (strokeWidth: number): number => (strokeWidth / this.localScale) * Math.pow(2, -this.zoomExp);

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

    private _screenToWorld(x: number, y: number): { x: number; y: number } {
        const inv = 1 / this._getZoom();
        return { x: (x - this.world.x) * inv, y: (y - this.world.y) * inv };
    }

    private _getViewRect(): BBox {
        const z = this._getZoom();
        return {
            x: -this.world.x / z,
            y: -this.world.y / z,
            width: this.app.renderer.width / z,
            height: this.app.renderer.height / z,
        };
    }

    private _drawStroke(g: Graphics & { lastZoom?: number }, rect: StrokeRect, z: number): void {
        if (rect.id !== "temp" && g.lastZoom === z) return;

        const s = rect.data;
        g.clear();
        g.moveTo(...s.pts[0]);
        for (let i = 1; i < s.pts.length; i++) g.lineTo(...s.pts[i]);
        g.stroke({ width: s.stroke.width, color: s.stroke.color });
        g.lastZoom = z;
    }
}
