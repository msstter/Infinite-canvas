import { Canvas } from './canvas.js';
import { ElementsManager } from './elements.js';
import { setupUI } from './ui.js';

const canvasElement = document.getElementById('canvas');
const canvas = new Canvas(canvasElement);
const elements = new ElementsManager();

function redraw() {
  canvas.draw(elements.getItems());
}

setupUI(canvas, elements, redraw);

canvasElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  const worldPos = canvas.screenToWorld(mouseX, mouseY);

  // TEMPORARY zoom calculation
  let newScale = canvas.scale * zoomFactor;

  // ✅ Clamp the zoom scale to a safe range
  newScale = Math.max(0.01, Math.min(newScale, 100)); // Adjust limits as needed

  // ✅ Adjust offset so we zoom centered around the cursor
  canvas.offsetX = mouseX - worldPos.x * newScale;
  canvas.offsetY = mouseY - worldPos.y * newScale;
  canvas.scale = newScale;

  redraw();
}, { passive: false });

redraw();