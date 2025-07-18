// app.ts
import { initDB, initListeners, initDraw, renderLoop } from "./canvas";
import { initControlListeners } from "./controls";

function initApp() {
    initDraw().then((draw) => {
        const db = initDB(draw);
        initListeners(draw, db);
        renderLoop(draw);
        initControlListeners(draw, db);
    });
}

window.onload = initApp;
