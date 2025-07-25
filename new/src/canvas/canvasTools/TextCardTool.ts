// canvas/canvasTools/TextCardTool.ts

import { CanvasView } from "../CanvasView";
import { CanvasTool, getQuadItem, TextCardProperties } from "../types";
import { blockDrawingEvent } from "./DrawTool";

export class TextCardTool implements CanvasTool {
    private view: CanvasView;

    constructor(view: CanvasView) {
        this.view = view;
    }

    pointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return; // only main click
        if (
            blockDrawingEvent(e.target as HTMLElement, true) // buttons / .notecard / .sub‑canvas
        ) {
            return;
        }

        const { x: sx, y: sy } = this.view.getLocalCoordsFromEvent(e);
        const { x, y } = this.view.screenToWorld(sx, sy);

        // convert 508 × 304 CSS‑px to world units
        const z: number = this.view.getZoom();
        const w = 508 / z;
        const h = 304 / z;

        const rect = getQuadItem<TextCardProperties>({
            id: crypto.randomUUID(),
            x: x - w / 2,
            y: y - h / 2,
            width: w,
            height: h,
            data: {
                type: "text-card",
                zoom: this.view.getZoomObj(),
                title: "New card",
                htmlString: "",
            },
        });

        this.view.model.addTextCard(rect);
    };

    pointerMove() {} // no‑op
    pointerUp() {} // no‑op
}
