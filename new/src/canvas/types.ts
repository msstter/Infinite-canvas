// canvas/types.ts
import { Rectangle } from "@timohausmann/quadtree-ts";

export type Point = [x: number, y: number];

export type CanvasViewOptions = {
    mainCanvas: boolean;
    /** A fixed width for the canvas in pixels. Ignored if fullscreen is true. */
    width: number;
    /** A fixed height for the canvas in pixels. Ignored if fullscreen is true. */
    height: number;
};

export interface StrokeData {
    pts: Point[];
    type: "stroke-rect";
    stroke: {
        width: number;
        color: number;
    };
}

export type BBox = { x: number; y: number; width: number; height: number };
export type Zoom = { zoomExp: number; localScale: number };

export interface QuadTreeItemProperties<Data extends Object> extends BBox {
    id: string;
    data: Data;
}
export type StrokeProperties = QuadTreeItemProperties<StrokeData>;

// export type StrokeRect = Rectangle<StrokeData> & StrokeProperties;

// // Type helper to convert properties to Rectangle. Also covertly adds quad tree properties that are not reflected in the types.
// export const StrokeRect = (s: StrokeProperties): StrokeRect => Object.assign(new Rectangle(s), { id: s.id, type: "stroke-rect" }) as StrokeRect;

export type TextCardData = {
    zoom: Zoom;
    type: "text-card";
    title: string;
    htmlString: string; // the text card content
};

export type TextCardProperties = QuadTreeItemProperties<TextCardData>;

export type WormholeCardData = {
    type: "wormhole-card";
    title: string;
    zoom: Zoom;
    targetPosition: BBox & { zoom: Zoom }; // Where it is pointing to in the world
};

export type WormholeCardProperties = QuadTreeItemProperties<WormholeCardData>;

export type QuadItemProperties = TextCardProperties | WormholeCardProperties | StrokeProperties;

export type QuadItem<P extends QuadItemProperties = QuadItemProperties> = Rectangle<P["data"]> & P;

export const getQuadItem = <P extends QuadItemProperties>(p: P) => {
    return Object.assign(new Rectangle<P["data"]>(p), { id: p.id }) as QuadItem<P>;
};

export const isStroke = (i: QuadItem): i is QuadItem<StrokeProperties> => i.data.type === "stroke-rect";
export const isTextCard = (i: QuadItem): i is QuadItem<TextCardProperties> => i.data.type === "text-card";

export const isWormholeCard = (i: QuadItem): i is QuadItem<WormholeCardProperties> => i.data.type === "wormhole-card";

export interface CanvasTool {
    pointerDown(e: PointerEvent): void;
    pointerMove(e: PointerEvent): void;
    pointerUp(e: PointerEvent): void;
}

export const colorPallet = {
    seafoam: 0x30535c,
    driftwood: 0xc1754d,
    peony: 0xf5e7de,
    squall: 0x9eb1af,
};
