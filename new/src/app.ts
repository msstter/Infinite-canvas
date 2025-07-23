// app.ts
import { DrawingModel } from "./DrawingData/DrawingModel";
import { CanvasView } from "./canvas/CanvasView";
import { initControlListeners } from "./controls";
import { initNotecard } from "./Notecard/Notecard";
import { initPalletButtons } from "./pallet/initPallet";

function initApp() {
    const model = new DrawingModel();
    initNotecard();
    const mainCanvasView = new CanvasView(document.body, model, { mainCanvas: true });

    initControlListeners(model, mainCanvasView);
    initPalletButtons();

    // Test second canvas
    const canvas2Container: HTMLElement | null = document.querySelector(".nested-canvas");
    if (canvas2Container) {
        const mainCanvasView = new CanvasView(canvas2Container, model, { mainCanvas: false, width: 400, height: 250 });
    }
}

window.onload = initApp;
