import { createStore } from "zustand/vanilla";

import { subscribeWithSelector } from "zustand/middleware";

export const activeToolKey = ["draw", "notecard", "zoom"] as const;
export type ActiveTool = (typeof activeToolKey)[number];
type State = {
    activeTool: ActiveTool;
    setActiveTool: (tool: ActiveTool) => void;
};

export const appStore = createStore<State>()(
    subscribeWithSelector((set) => ({
        activeTool: "draw",
        setActiveTool: (tool: ActiveTool) => set({ activeTool: tool }),
    }))
);

// Selectors to subscribe to individual bits of state.
export const singleSubscribe = {
    activeTool: <R>(cb: (tool: ActiveTool) => R) => {
        appStore.subscribe((state) => state.activeTool, cb);
    },
};
