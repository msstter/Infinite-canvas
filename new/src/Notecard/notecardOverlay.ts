/* canvas/NotecardOverlay.ts ---------------------------------------------- */
import { QuadItem, TextCardProperties } from "../canvas/types";
import { CanvasView } from "../canvas/CanvasView";
import { Notecard } from "../Notecard/Notecard";

export class NotecardOverlay {
    /** Absolutely‑positioned container that sits on top of one canvas */
    private host: HTMLDivElement;
    /** id → DOM element */
    private cards = new Map<string, HTMLDivElement>();
    /** Incremented every frame so we can GC unused cards */
    private frame = 0;

    constructor(canvasEl: HTMLCanvasElement) {
        this.host = document.createElement("div");
        Object.assign(this.host.style, {
            position: "absolute",
            inset: "0",
            pointerEvents: "none",
        });
        canvasEl.parentElement!.appendChild(this.host);
    }

    /** Call once at the *beginning* of a render‑loop iteration */
    beginFrame() {
        this.frame++;
    }

    /** Feed *one* visible text‑card per call */
    sync(view: CanvasView, rect: QuadItem<TextCardProperties>) {
        const id = rect.id;
        const zView = view.getZoom();
        const zCard = Math.pow(2, rect.data.zoom.zoomExp) * rect.data.zoom.localScale;
        const scale = zView / zCard;

        // world‑units → screen‑px
        const sx = rect.x * zView + view["world"].x;
        const sy = rect.y * zView + view["world"].y;
        const screenW = rect.width * zView;

        // Ignore if too small on screen
        if (screenW < 50) {
            const el = this.cards.get(id);
            if (el) el.style.display = "none";
            return;
        }

        // Create DOM node lazily
        let el = this.cards.get(id);
        if (!el) {
            el = new Notecard(0, 0, 508, 304).getElement();
            Object.assign(el.style, {
                position: "absolute",
                transformOrigin: "top left",
                pointerEvents: "auto",
                willChange: "transform",
            });
            this.host.appendChild(el);
            this.cards.set(id, el);
        }
        el.style.display = "";
        el.dataset.frame = String(this.frame); // mark as kept this frame
        el.style.transform = `translate(${sx}px,${sy}px) scale(${scale})`;
    }

    /** Call once *after* the for‑loop to clean up any cards not seen this frame */
    endFrame() {
        const current = String(this.frame);
        for (const [id, el] of this.cards) {
            if (el.dataset.frame !== current) {
                this.host.removeChild(el);
                this.cards.delete(id);
            }
        }
    }
}
