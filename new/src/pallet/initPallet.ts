import { ActiveTool, activeToolKey, singleSubscribe, appStore } from "../appState";
import { DrawApp } from "../canvas/canvas";

const getToolDataAttr = (el: HTMLElement): ActiveTool => {
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

    // Handle updating based on active tool change in a single place.
    singleSubscribe.activeTool((tool) => {
        console.log("Active tool changed: ", tool);
        palletButtons.forEach((btn) => {
            if (getToolDataAttr(btn) === tool) {
                btn.classList.add("selected");
            } else {
                btn.classList.remove("selected");
            }
        });
    });

    const handlePointerDown = (e: PointerEvent) => {
        if (e.currentTarget) {
            const btn = e.currentTarget as HTMLButtonElement;
            const tool = getToolDataAttr(btn);
            appStore.setState({ activeTool: tool });
        }
    };

    palletButtons.forEach((button: HTMLButtonElement) => {
        button.addEventListener("pointerdown", handlePointerDown);
    });
}
