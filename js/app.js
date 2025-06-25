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
  canvas.scale *= zoomFactor;
  canvas.offsetX = mouseX - worldPos.x * canvas.scale;
  canvas.offsetY = mouseY - worldPos.y * canvas.scale;

  redraw();
}, { passive: false });

redraw();