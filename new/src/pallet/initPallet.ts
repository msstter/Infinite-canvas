import { ActiveTool, activeToolKey } from "./../canvas/canvas";
import { DrawApp, activeToolKey } from "../canvas/canvas";

const getActiveTool = (el: HTMLElement): ActiveTool => {
    const tool = el.getAttribute("data-tool");
    if (activeToolKey.includes(tool as ActiveTool)) {
        return tool as ActiveTool;
    } else {
        console.log("Element:", el);
        throw new Error("Element does not have tool data attribute");
    }
};

export function initPalletButtons(draw: DrawApp) {
    const palletButtons = document.querySelectorAll(".pallet-btn") as NodeListOf<HTMLButtonElement>;

    const handlePointerDown = (e: PointerEvent) => {
        palletButtons.forEach((button) => {
            button.classList.remove("selected");
        });
        if (e.currentTarget) {
            const btn = e.currentTarget as HTMLButtonElement;
            btn.classList.add("selected");
            const tool = getActiveTool(btn);
            draw.drawState.activeTool = tool;
            console.log("active tool", draw.drawState.activeTool);
        }
    };

    palletButtons.forEach((button: HTMLButtonElement) => {
        button.addEventListener("pointerdown", handlePointerDown);
    });
}
