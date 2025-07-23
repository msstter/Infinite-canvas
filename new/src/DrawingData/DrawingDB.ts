// DrawingDB.ts

import Dexie, { Table } from "dexie";
import { StrokeRect } from "../canvas/canvas";

// The keys are tables, with arrays of the rows.
export type DrawingDataSchema = { strokes: StrokeRect[] };

export class DrawingDB extends Dexie {
    strokes!: Table<StrokeRect, string>;
    constructor() {
        super("canvas");
        this.version(1).stores({ strokes: "id" }); // primary key only
    }

    public async clearDB(): Promise<void> {
        await Dexie.delete("canvas");
    }
}
