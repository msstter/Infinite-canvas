// drawingModel.ts
import { Quadtree, Rectangle } from "@timohausmann/quadtree-ts";
import { createStore, StoreApi } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import { StrokeData, BBox, StrokeProperties, QuadItem, getQuadItem, TextCardProperties, isStroke, isTextCard, TextCardData } from "../canvas/types";
import { DrawingDB } from "./DrawingDB";
import { DrawingDataService } from "./DrawingDataService";

// ─── 1.  Zustand Store Definition ─────────────────────────────────────────────

type DrawingModelState = {
    /** A simple counter that increments whenever the drawing data changes. Views subscribe to this to know when to re-render. */
    revision: number;
    /** A flag to indicate that the initial data has been loaded from the database. */
    initialized: boolean;
};

type DrawingModelActions = {
    incrementRevision: () => void;
    setInitialized: (value: boolean) => void;
};

// This is the full type for our vanilla Zustand store
type DrawingStore = StoreApi<DrawingModelState & DrawingModelActions>;

const createDrawingModelStore = () => {
    return createStore<DrawingModelState & DrawingModelActions>()(
        subscribeWithSelector((set) => ({
            revision: 0,
            initialized: false,
            // Internal action to notify subscribers of a change.
            incrementRevision: () => set((state) => ({ revision: state.revision + 1 })),
            // Internal action to signal that loading is complete.
            setInitialized: (value) => set({ initialized: value }),
        }))
    );
};

// ─── 2.  Drawing Model Class ──────────────────────────────────────────────────

export class DrawingModel {
    /** The single source of truth for all stroke geometry, spatially indexed. */
    private tree: Quadtree<QuadItem>;

    /** The database instance for persisting strokes. */
    private db: DrawingDB;
    private dataService: DrawingDataService;

    /** The Zustand store for state management and notifications. Views will subscribe to this. */
    public store: ReturnType<typeof createDrawingModelStore>;

    constructor() {
        this.tree = this.initQuadtree();
        this.db = new DrawingDB();
        this.dataService = new DrawingDataService(this.db);

        // Create the vanilla Zustand store. This will be the heart of our observer pattern.
        this.store = createDrawingModelStore();
    }

    /**
     * Initializes the model by loading all strokes from IndexedDB into the quadtree.
     * This must be called once after the model is created.
     */
    public async init(): Promise<void> {
        try {
            const [allStrokes, allCards] = await Promise.all([
                this.db.strokes.toArray(),
                this.db.textCards.toArray(), // NEW
            ]);

            for (const s of [...allStrokes, ...allCards]) {
                this.tree.insert(getQuadItem(s as any)); // 'any' because this function is generic
            }
            console.log(`DrawingModel: Initialized with ${allStrokes.length} strokes ` + `and ${allCards.length} text cards from DB.`);
        } catch (err) {
            console.error("DrawingModel: DB init failed", err);
        } finally {
            this.store.getState().setInitialized(true);
            this.store.getState().incrementRevision();
        }
    }

    /**
     * Creates a new stroke, adds it to the quadtree, saves it to the database,
     * and notifies all subscribed views of the change.
     * @param data The raw data for the new stroke (points, width, color).
     */
    public addStroke(data: StrokeData): void {
        // Calculate the bounding box for the new stroke
        const xs = data.pts.map((p) => p[0]);
        const ys = data.pts.map((p) => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        // Add a margin around the bounding box based on the stroke width
        const margin = data.stroke.width / 2;

        const rect = getQuadItem<StrokeProperties>({
            id: crypto.randomUUID(),
            x: minX - margin,
            y: minY - margin,
            width: maxX - minX + data.stroke.width,
            height: maxY - minY + data.stroke.width,
            data,
        });

        // Update state
        this.tree.insert(rect);
        this.saveItemToDB(rect);

        // Notify all subscribers that data has changed by incrementing the revision.
        this.store.getState().incrementRevision();
    }

    /**
     * Retrieves all strokes that intersect with the given bounding box.
     * This is the primary method used by views to get the data they need to render.
     * @param bounds The visible area of a canvas.
     * @returns An array of StrokeRect objects.
     */
    public getVisibleItems(bounds: BBox): QuadItem[] {
        // The quadtree library's retrieve method is highly efficient.
        return this.tree.retrieve(new Rectangle(bounds));
    }

    /**
     * Private helper to initialize the quadtree with vast bounds.
     */
    private initQuadtree(): Quadtree<QuadItem> {
        const QT_BOUNDS: BBox = { x: -1e13, y: -1e13, width: 2e13, height: 2e13 };
        return new Quadtree<QuadItem>(QT_BOUNDS);
    }
    public async getTextCardById(id: string): Promise<QuadItem<TextCardProperties> | undefined> {
        // 1. Hit IndexedDB by primary key to get the last‑saved bbox
        const saved = await this.db.textCards.get(id);
        if (!saved) return undefined;

        // 2. Look up that bbox in the quadtree
        const hits = this.tree.retrieve(
            new Rectangle(saved) // saved already has x, y, width, height
        ) as QuadItem<TextCardProperties>[];

        // 3. Filter for exact id (k is usually 1)
        return hits.find((h) => h.id === id);
    }

    async updateTextCard(id: string, patch: Partial<TextCardData>, newBBox?: Partial<BBox>): Promise<void> {
        const card = await this.getTextCardById(id);
        if (!card) {
            console.warn(`updateTextCard: no card with id ${id} found`);
            return;
        }

        // mutate in place
        Object.assign(card.data, patch);
        if (newBBox) Object.assign(card, newBBox);

        // 1️⃣  re‑index inside the quadtree
        this.tree.update(card, true);

        // 2️⃣  persist (put = upsert, so it overwrites the row with same PK)
        await this.saveItemToDB(card);

        // 3️⃣  notify views
        this.store.getState().incrementRevision();
    }

    /**
     * Private helper to save a stroke to the database, cleaning it first.
     */
    async saveItemToDB(item: QuadItem<StrokeProperties | TextCardProperties>): Promise<void> {
        // structuredClone creates a deep copy and removes methods/prototypes.
        const clone = structuredClone(item);
        // The quadtree adds a private `qtIndex` property during insertion; we must remove it before saving.

        if (isStroke(clone)) {
            const { qtIndex, ...rest } = clone;
            await this.db.strokes.put(rest);
        } else if (isTextCard(clone)) {
            const { qtIndex, ...rest } = clone;
            await this.db.textCards.put(rest);
        }
    }
    public addTextCard(rect: QuadItem<TextCardProperties>): void {
        this.tree.insert(rect);
        this.saveItemToDB(rect);
        this.store.getState().incrementRevision();
    }
    async deleteTextCard(id: string): Promise<void> {
        const card = await this.getTextCardById(id);
        if (!card) return;
        this.tree.remove(card);
        await this.db.textCards.delete(card.id);
        this.store.getState().incrementRevision();
    }

    public async exportDrawingData() {
        return await this.dataService.exportDrawingToJson();
    }
    public async loadFromFile(file: File): Promise<void> {
        try {
            const jsonContent = await file.text();

            // 1. Delegate DB update to the service
            await this.dataService.importFromJson(jsonContent);

            // 2. Manually rebuild the in-memory state (quadtree)
            console.log("Rebuilding quadtree from newly imported data...");
            this.tree.clear();
            const allStrokes = await this.db.strokes.toArray();
            for (const s of allStrokes) {
                const rect = getQuadItem(s as StrokeProperties);
                this.tree.insert(rect);
            }

            // 3. Notify all views of the major change
            this.store.getState().incrementRevision();
            console.log(`Successfully loaded and rebuilt drawing from file: ${file.name}`);
        } catch (error) {
            console.error(`Failed to load drawing from file ${file.name}:`, error);
            throw error; // Re-throw for the UI to handle
        }
    }
    clearDrawing() {
        this.db.clearDB();
        location.reload(); // UI side-effect is ok in a static utility method like this.
    }
}
