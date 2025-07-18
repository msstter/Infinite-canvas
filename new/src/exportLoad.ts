// exportLoad.ts
// Export provides functionality to export the user's data to a json file.

import { CanvasDB, DrawApp, StrokeRect } from "./canvas";

// Save provides functionality to load the user's data from a json file.
export async function exportCanvas(db: CanvasDB) {
    // 1.  Read every stroke from IndexedDB
    const strokes = await db.strokes.toArray();

    console.log(strokes);
    // Remove the top level id
    const cleanStrokes = strokes.map((stroke) => {
        const { id, ...rest } = stroke;
        return rest;
    });

    // // 3.  Turn into a Blob and trigger download
    const blob = new Blob([JSON.stringify(cleanStrokes)], {
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

export async function importCanvas(file: File, draw: DrawApp, db: CanvasDB) {
    // 1.  Read file text
    const text = await file.text();
    const strokes: StrokeRect[] = JSON.parse(text);

    // 2.  Clear existing data (optional)
    await db.strokes.clear();
    draw.tree.clear(); // start over in memory too
    draw.strokeCache.clear();

    // 3.  Re‑hydrate each record and insert
    for (const raw of strokes) {
        const rect = StrokeRect(raw); // rebuild prototype
        draw.tree.insert(rect);
        await db.strokes.put(rect);
    }
}
