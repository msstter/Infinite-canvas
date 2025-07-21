// app.ts
import { initDB, initListeners, initDraw, renderLoop } from "./canvas/canvas";
import { initControlListeners } from "./controls";
import { initPalletButtons } from "./pallet/initPallet";

function initApp() {
    initDraw().then((draw) => {
        const db = initDB(draw);
        initListeners(draw, db);
        renderLoop(draw);
        initControlListeners(draw, db);
        initPalletButtons(draw);
    });
}

window.onload = initApp;
