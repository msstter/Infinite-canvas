// controls.ts
import { CanvasView } from "./canvas/CanvasView";
import { DrawingModel } from "./DrawingData/DrawingModel";

const addClear = (model: DrawingModel) => {
    const btn = document.querySelector(".clear-btn");
    if (!btn) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        model.clearDrawing();
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
const addExport = (model: DrawingModel) => {
    const btn = document.querySelector(".export-btn");
    if (!btn) return;

    btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        model.exportDrawingData().then((json) => {
            exportFile(json);
        });
    });
};

const addImport = (model: DrawingModel, mainCanvasView: CanvasView) => {
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
            mainCanvasView.drawState.frozen = true;
            mainCanvasView.drawState.active = false;
            const files = this.files;
            if (!files || files.length == 0) return;
            const json: File = files[0];
            await model.loadFromFile(json);
            mainCanvasView.drawState.frozen = false;
        },
        false
    );
};

export const initControlListeners = (model: DrawingModel, mainCanvasView: CanvasView) => {
    addClear(model);
    addExport(model);
    addImport(model, mainCanvasView);
};

// Adds event listeners for controls.

// Clear button
