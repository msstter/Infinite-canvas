// DrawingDB.ts

import Dexie, { Table } from "dexie";
import { StrokeProperties, TextCardProperties } from "../canvas/types";

// The keys are tables, with arrays of the rows.
export type DrawingDataSchema = { strokes: StrokeProperties[]; textCards: TextCardProperties[] };

export class DrawingDB extends Dexie {
    strokes!: Table<StrokeProperties, string>;
    textCards!: Table<TextCardProperties, string>;
    constructor() {
        super("canvas");
        this.version(1).stores({ strokes: "id", textCards: "id" }); // id is primary key
    }

    public async clearDB(): Promise<void> {
        await Dexie.delete("canvas");
        await Dexie.delete("textCards");
    }
}
