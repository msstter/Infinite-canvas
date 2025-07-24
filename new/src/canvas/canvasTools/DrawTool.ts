import { Graphics } from "pixi.js";
import { CanvasView } from "../CanvasView";
import { CanvasTool, getQuadItem, StrokeData } from "../types";

export const blockDrawingEvent = (target: HTMLElement, mainCanvas: boolean) => {
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

export class DrawTool implements CanvasTool {
    private view: CanvasView; // for screen‑to‑world helpers

    constructor(view: CanvasView) {
        this.view = view;
    }

    get canvas(): HTMLElement {
        return this.view.options.mainCanvas ? document.body : this.view.app.canvas;
    }
    pointerDown = (e: PointerEvent) => {
        if (this.view.options.mainCanvas === false) e.stopPropagation();
        if (this.view.drawState.frozen || (e.button !== 0 && e.pointerType === "mouse")) return;
        if (e.target && blockDrawingEvent(e.target as HTMLElement, this.view.options.mainCanvas ?? false)) return;
        this.view.drawState.active = true;
        this.view.drawState.pointerID = e.pointerId;
        this.view.drawState.pts = [];
        const localCoords = this.view.getLocalCoordsFromEvent(e);
        const worldPoint = this.view.screenToWorld(localCoords.x, localCoords.y);

        this.view.drawState.pts.push([worldPoint.x, worldPoint.y]);

        this.view.drawState.g = new Graphics();
        this.view.strokeCache.set("temp", this.view.drawState.g);
        this.view.world.addChild(this.view.drawState.g);

        this.canvas.setPointerCapture(e.pointerId);
    };

    pointerMove(e: PointerEvent) {
        // Move to DrawTool
        if (this.view.options.mainCanvas === false) e.stopPropagation();
        if (this.view.drawState.frozen || !this.view.drawState.active || e.pointerId !== this.view.drawState.pointerID) return;
        if (e.target && blockDrawingEvent(e.target as HTMLElement, this.view.options.mainCanvas ?? false)) return;
        const localCoords = this.view.getLocalCoordsFromEvent(e);
        const worldPoint = this.view.screenToWorld(localCoords.x, localCoords.y);

        const last = this.view.drawState.pts[this.view.drawState.pts.length - 1];
        if (Math.hypot(worldPoint.x - last[0], worldPoint.y - last[1]) < 1 / this.view.getZoom()) return;

        this.view.drawState.pts.push([worldPoint.x, worldPoint.y]);

        const tempRect = getQuadItem({
            id: "temp",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            data: {
                type: "stroke-rect",
                pts: this.view.drawState.pts,
                stroke: { width: this.view.getScaledStroke(this.view.drawState.width), color: this.view.drawState.color },
            },
        });
        this.view.drawStroke(this.view.drawState.g!, tempRect, this.view.getZoom());
    } // no‑op
    pointerUp(e: PointerEvent) {
        if (e.pointerId === this.view.drawState.pointerID) {
            if (this.view.drawState.g) {
                this.view.world.removeChild(this.view.drawState.g);
                this.view.strokeCache.delete("temp");
                this.view.drawState.g = null;
            }

            if (this.view.drawState.frozen || !this.view.drawState.active || this.view.drawState.pts.length < 2) {
                this.view.drawState.active = false;
                return;
            }

            const data: StrokeData = {
                type: "stroke-rect",
                pts: this.view.drawState.pts,
                stroke: { width: this.view.getScaledStroke(this.view.drawState.width), color: this.view.drawState.color },
            };

            // This is the key interaction: the view asks the model to add the stroke.
            this.view.model.addStroke(data);

            this.view.drawState.active = false;
        }
    } // no‑op
}
