import { ActiveTool } from "./../../appState";
import { CanvasView } from "../CanvasView";
import { EmptyTool } from "./EmptyTool";
import { DrawTool } from "./DrawTool";
import { TextCardTool } from "./TextCardTool";

export const getCanvasTool = (view: CanvasView, tool: ActiveTool) => {
    if (view.options.mainCanvas) {
        if (tool === "draw") {
            view.canvasTool = new DrawTool(view);
        } else if (tool === "notecard") {
            view.canvasTool = new TextCardTool(view);
        } else {
            // For now we default to draw tool
            view.canvasTool = new DrawTool(view);
        }
    } else {
        // For sub-canavses we do not allow pointer tools
        return EmptyTool;
    }
};
