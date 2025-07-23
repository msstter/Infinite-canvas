// controls.ts
import { DrawApp } from "./canvas/canvas";

const addClear = (draw: DrawApp) => {
    const btn = document.querySelector(".clear-btn");
    if (!btn) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        draw.model.clearDrawing();
    });
};

// Save provides functionality to load the user's data from a json file.
export async function exportFile(json: string) {
    // // 3.  Turn into a Blob and trigger download
    const blob = new Blob([json], {
        type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "endless-canvas.json";
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
}
const addExport = (draw: DrawApp) => {
    const btn = document.querySelector(".export-btn");
    if (!btn) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        draw.model.exportDrawingData().then((json) => {
            exportFile(json);
        });
    });
};

const addImport = (draw: DrawApp) => {
    const btn = document.querySelector(".import-btn");
    const input = document.getElementById("upload-file") as HTMLInputElement | null;
    if (!btn || !input) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        input.click();
    });

    input.addEventListener(
        "change",
        async function (e) {
            // Pause drawing to avoid accidental click
            draw.drawState.frozen = true;
            draw.drawState.active = false;
            const files = this.files;
            if (!files || files.length == 0) return;
            const json: File = files[0];
            await draw.model.loadFromFile(json);
            draw.drawState.frozen = false;
        },
        false
    );
};

export const initControlListeners = (draw: DrawApp) => {
    addClear(draw);
    addExport(draw);
    addImport(draw);
};

// Adds event listeners for controls.

// Clear button
