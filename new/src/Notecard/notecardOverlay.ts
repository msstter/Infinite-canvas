import { CanvasView } from "../canvas/CanvasView";
import { QuadItem, TextCardProperties } from "../canvas/types";
import { Notecard } from "./Notecard";

/* canvas/NotecardOverlay.ts ----------------------------------------------- */
export class NotecardOverlay {
    private host: HTMLElement; // <div> absolutely‑positioned over the canvas
    private cards = new Map<string, HTMLElement>(); // id → DOM element

    constructor(canvasEl: HTMLCanvasElement) {
        // one overlay div per <canvas>; it sits in the same stacking context
        this.host = document.createElement("div");
        Object.assign(this.host.style, {
            position: "absolute",
            inset: "0", // full size of the canvas
            pointerEvents: "none", // events still reach the canvas
        });
        canvasEl.parentElement!.appendChild(this.host);
    }

    /** Sync the DOM to the set of visible TextCard items */
    sync(view: CanvasView, items: QuadItem<TextCardProperties>[]) {
        const zView = view.getZoom();
        const world = view["world"]; // for world.x / world.y

        // Mark everything unused first
        for (const el of this.cards.values()) el.dataset.keep = "0";

        for (const rect of items) {
            const id = rect.id;
            const { width: baseW, height: baseH } = rect; // == 508/z0, 304/z0
            const zCard = Math.pow(2, rect.data.zoom.zoomExp) * rect.data.zoom.localScale;
            const scale = zView / zCard;
            const screenW = baseW * zView; // == 508 * scale
            if (screenW < 50) {
                // too small → skip render
                const el = this.cards.get(id);
                if (el) el.style.display = "none";
                continue;
            }

            // Create if necessary
            let el = this.cards.get(id);
            if (!el) {
                el = new Notecard(0, 0, 508, 304).getElement(); // fixed base size
                el.style.position = "absolute";
                el.style.transformOrigin = "top left";
                el.style.pointerEvents = "auto"; // enable interaction
                this.host.appendChild(el);
                this.cards.set(id, el);
            }
            el.style.display = ""; // ensure visible
            el.dataset.keep = "1";

            // World → screen transform
            const sx = rect.x * zView + world.x; // same math as PIXI does internally
            const sy = rect.y * zView + world.y;

            // GPU‑friendly translate+scale
            el.style.transform = `translate(${sx}px,${sy}px) scale(${scale})`;
        }

        // Remove elements no longer in view
        for (const [id, el] of this.cards) {
            if (el.dataset.keep === "0") {
                this.host.removeChild(el);
                this.cards.delete(id);
            }
        }
    }
}
