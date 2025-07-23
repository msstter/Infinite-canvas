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
            // Add validation for the new cards table
            if (!parsedData || !Array.isArray(parsedData.strokes) || !Array.isArray(parsedData.textCards)) {
                throw new Error("Invalid format: JSON must have 'strokes' and 'cards' arrays.");
            }
        } catch (e: any) {
            throw new Error(`JSON parsing or validation failed: ${e.message}`);
        }

        await this.db.transaction("rw", this.db.tables, async () => {
            // This generic loop already handles clearing all tables
            for (const tableName in parsedData) {
                if (this.db.table(tableName)) {
                    // Check if table exists
                    await this.db.table(tableName).clear();
                }
            }
            // Bulk-add data to each table
            await this.db.strokes.bulkAdd(parsedData.strokes);
            await this.db.textCards.bulkAdd(parsedData.textCards);
        });

        return parsedData;
    }
}
