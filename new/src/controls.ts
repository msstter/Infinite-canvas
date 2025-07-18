// controls.ts
import { CanvasDB, clearDB, DrawApp } from "./canvas";
import { exportCanvas, importCanvas } from "./exportLoad";
const addClear = () => {
    const btn = document.querySelector(".clear-btn");
    if (!btn) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        clearDB();
    });
};

const addExport = (db: CanvasDB) => {
    const btn = document.querySelector(".export-btn");
    if (!btn) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        exportCanvas(db);
    });
};

const addImport = (draw: DrawApp, db: CanvasDB) => {
    const btn = document.querySelector(".import-btn");
    const input = document.getElementById("upload-file") as HTMLInputElement | null;
    if (!btn || !input) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        input.click();

        // importCanvas(db);
    });

    input.addEventListener(
        "change",
        async function (e) {
            const files = this.files;
            if (!files || files.length == 0) return;
            const json: File = files[0];
            await importCanvas(json, draw, db);
        },
        false
    );
};

export const initControlListeners = (draw: DrawApp, db: CanvasDB) => {
    addClear();
    addExport(db);
    addImport(draw, db);
};

// Adds event listeners for controls.

// Clear button
