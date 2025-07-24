/* canvas/NotecardOverlay.ts ---------------------------------------------- */
import { BBox, isTextCard, QuadItem, TextCardData, TextCardProperties } from "../canvas/types";
import type { CanvasView } from "../canvas/CanvasView";
import { Notecard } from "../Notecard/Notecard";
import { appStore } from "../appState";
const debounce = (fn: () => void, ms = 400) => {
    let t: number | undefined;
    return () => {
        clearTimeout(t);
        t = window.setTimeout(fn, ms);
    };
};
export class NotecardOverlay {
    /** Absolutely‑positioned container that sits on top of one canvas */
    private host: HTMLDivElement;
    readonly view: CanvasView;
    /** id → DOM element */
    private notecards = new Map<string, Notecard>();

    /** Incremented every frame so we can GC unused cards */
    private frame = 0;
    handleDelete: (id: string) => Promise<void>;
    updateTextCard: (id: string, patch: Partial<TextCardData>, newBBox?: Partial<BBox>) => Promise<void>;

    constructor(view: CanvasView) {
        this.host = document.createElement("div");
        this.view = view;
        Object.assign(this.host.style, {
            position: "absolute",
            inset: "0",
            pointerEvents: "none",
        });
        const canvasEl = view.app.canvas;
        this.handleDelete = this.view.model.deleteTextCard.bind(this.view.model);
        this.updateTextCard = this.view.model.updateTextCard.bind(this.view.model);
        canvasEl.parentElement!.appendChild(this.host);
        this.subscribe(); // Subscribe to changes in text card data form model
        this.initHandlers();
    }

    init() {
        // visible area of *this* canvas
        const viewRect = this.view.getViewRect();

        // ask the model for everything in view
        const items = this.view.model.getVisibleItems(viewRect);
        console.log("visible items", items);
        // draw the ones that are text‑cards
        for (const it of items) {
            if (isTextCard(it)) this.syncPosition(it);
        }
    }

    attachHandlers(note: Notecard) {
        const { id } = note;
        const root = note.getElement();

        // ---- Title -----------------------------------------------------
        const titleEl = root.querySelector<HTMLSpanElement>(".notecard-title");
        if (titleEl && !titleEl.dataset.bound) {
            titleEl.addEventListener("blur", () => {
                this.updateTextCard(id, { title: titleEl.innerText.trim() });
            });
            titleEl.dataset.bound = "true";
        }

        // ---- Content ---------------------------------------------------
        const contentEl = root.querySelector<HTMLDivElement>(".notecard-content");
        if (contentEl && !contentEl.dataset.bound) {
            // Commit on blur (guaranteed) …
            contentEl.addEventListener("blur", () => {
                this.updateTextCard(id, { htmlString: contentEl.innerHTML });
            });
            // …and on‑type with debounce for live sync
            contentEl.addEventListener(
                "input",
                debounce(() => {
                    this.updateTextCard(id, { htmlString: contentEl.innerHTML });
                })
            );
            contentEl.dataset.bound = "true";
        }
    }
    /** Attach input / blur listeners exactly once per Notecard */
    initHandlers() {
        for (const [id, note] of this.notecards) {
            this.attachHandlers(note);
        }
    }

    /** Call once at the *beginning* of a render‑loop iteration */
    beginFrame() {
        this.frame++;
    }

    /** Feed *one* visible text‑card per call */
    syncPosition(rect: QuadItem<TextCardProperties>) {
        const id = rect.id;
        const zView = this.view.getZoom();
        const zCard = Math.pow(2, rect.data.zoom.zoomExp) * rect.data.zoom.localScale;
        const scale = zView / zCard;

        // world‑units → screen‑px
        const sx = rect.x * zView + this.view["world"].x;
        const sy = rect.y * zView + this.view["world"].y;
        const screenW = rect.width * zView;

        // Ignore if too small on screen
        if (screenW < 50) {
            const el = this.notecards.get(id)?.getElement();
            if (el) el.style.display = "none";
            return;
        }

        // Create DOM node lazily
        let note = this.notecards.get(id);
        if (!note) {
            note = new Notecard(0, 0, 508, 304, id, (note) => this.handleDelete(note.id));
            Object.assign(note.getElement().style, {
                position: "absolute",
                transformOrigin: "top left",
                pointerEvents: "auto",
                willChange: "transform",
            });
            this.host.appendChild(note.getElement());
            this.notecards.set(id, note);
            this.attachHandlers(note);
        }
        note.getElement().style.display = "";
        note.getElement().dataset.frame = String(this.frame); // mark as kept this frame
        note.getElement().style.transform = `translate(${sx}px,${sy}px) scale(${scale})`;
    }

    subscribe() {
        this.view.model.store.subscribe(
            (state) => state.textCards,
            (cards) => {
                for (const [id, note] of this.notecards) {
                    const newData = cards[id];
                    note.setContent(newData.data.htmlString);
                    note.setTitle(newData.data.title);
                }
            }
        );
    }

    /** Call once *after* the for‑loop to clean up any cards not seen this frame */
    endFrame() {
        const current = String(this.frame);
        for (const [id, el] of this.notecards) {
            if (el.getElement().dataset.frame !== current) {
                try {
                    this.host.removeChild(el.getElement());
                } catch {
                    // Means child is already removed, e.g., by delete button}

                    this.notecards.delete(id);
                }
            }
        }
    }
}
