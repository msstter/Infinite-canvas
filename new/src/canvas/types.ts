// canvas/types.ts
import { Rectangle } from "@timohausmann/quadtree-ts";

export type Point = [x: number, y: number];

export interface StrokeData {
    pts: Point[];
    stroke: {
        width: number;
        color: number;
    };
}

export type BBox = { x: number; y: number; width: number; height: number };

export interface StrokeRectProperties extends BBox {
    data: StrokeData;
    id: string;
}

export type StrokeRect = Rectangle<StrokeData> & StrokeRectProperties;

// Type helper to convert properties to Rectangle. Also covertly adds quad tree properties that are not reflected in the types.
export const StrokeRect = (s: StrokeRectProperties): StrokeRect => Object.assign(new Rectangle(s), { id: s.id }) as StrokeRect;

export type CanvasViewOptions = {
    mainCanvas: boolean;
    /** A fixed width for the canvas in pixels. Ignored if fullscreen is true. */
    width: number;
    /** A fixed height for the canvas in pixels. Ignored if fullscreen is true. */
    height: number;
};
