https://pixijs.com/8.x/
- Library for WebGL rendering

timohausmann/quadtree-ts

# Architecture
- Quadtree Pointer → Camera (pan/zoom matrix)
           ↓
       Viewport rectangle               ┌──────────┐
           ↓                            │ Dexie DB │
Quadtree.rangeQuery(viewRect) ──►       └──────────┘
           ↓                                    ▲
     Visible strokes          load/save json ⇆  │
           ↓                                    │
GPU draw‑list  ───►  PixiJS Graphics / Mesh  ←──┘
