// app.ts
import { DrawingModel } from "./DrawingData/DrawingModel";
import { initListeners, initDraw, renderLoop } from "./canvas/canvas";
import { initControlListeners } from "./controls";
import { initNotecard } from "./matt/notecard";
import { initPalletButtons } from "./pallet/initPallet";

function initApp() {
    const model = new DrawingModel();
    initNotecard();
    initDraw(model).then((draw) => {
        initListeners(draw);
        renderLoop(draw);
        initControlListeners(draw);
        initPalletButtons(draw);
    });
}

window.onload = initApp;
