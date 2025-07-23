// DrawingDataService.ts

import { DrawingDB, DrawingDataSchema } from "./DrawingDB";

export class DrawingDataService {
    private db: DrawingDB;

    constructor(db: DrawingDB) {
        this.db = db;
    }

    /**
     * Exports all tables from the database into a JSON string.
     */
    public async exportDrawingToJson(): Promise<string> {
        const exportData: { [tableName: string]: any[] } = {};
        for (const table of this.db.tables) {
            exportData[table.name] = await table.toArray();
        }
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Replaces database content from a JSON string within a single transaction.
     * @param jsonString The string content of a previously exported JSON file.
     * @returns The parsed data that was successfully imported.
     */
    public async importFromJson(jsonString: string): Promise<DrawingDataSchema> {
        let parsedData: DrawingDataSchema;

        try {
            parsedData = JSON.parse(jsonString);
            if (!parsedData || !Array.isArray(parsedData.strokes)) {
                throw new Error("Invalid format: JSON must have a 'strokes' array.");
            }
        } catch (e: any) {
            throw new Error(`JSON parsing or validation failed: ${e.message}`);
        }

        await this.db.transaction("rw", this.db.tables, async () => {
            for (const tableName in parsedData) {
                const table = this.db.table(tableName);
                await table.clear();
            }
            await this.db.strokes.bulkAdd(parsedData.strokes);
        });

        return parsedData;
    }
}
