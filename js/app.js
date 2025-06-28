/**
 * The Main Entry Point for the Application
 * * This file acts as the "Director" of our application. Its primary jobs are:
 * 1. To import and create instances of all the major modules (the "actors").
 * 2. To define the main rendering loop (`redraw`).
 * 3. To connect the modules so they can work together.
 * 4. To set up global event listeners like zooming.
 */

// --- 1. IMPORTS ---
// We import the main classes/functions from our other modules.
// This allows us to use their functionality in this file.
import { Canvas } from './canvas.js';
import { ElementsManager } from './elements.js';
import { setupUI } from './ui.js';

// --- 2. INITIALIZATION ---
// Here, we create the core objects that will manage our application's state and display.

// Get the actual <canvas> element from our HTML file.
const canvasElement = document.getElementById('canvas');

// Create an instance of our Canvas class. This is our "Artist" module,
// responsible for all the drawing logic.
const canvas = new Canvas(canvasElement);

// Create an instance of our ElementsManager. This is our "Librarian" or "Data Brain,"
// responsible for managing the list of all items on the canvas.
const elements = new ElementsManager();


// --- 3. THE CORE RENDERING FUNCTION ---

/**
 * redraw()
 * This is the heart of the application's display. Whenever something changes
 * (an item is added, moved, or the canvas is zoomed), this function is called
 * to update what the user sees.
 */
function redraw() {
  // It gets the most up-to-date list of items from our data manager (`elements`)
  // and hands that list to our artist (`canvas`) to be painted on the screen.
  canvas.draw(elements.getItems(), elements.getSelected());
}


// --- 4. UI SETUP ---

// We call the setupUI function from our ui.js module.
// We pass it the main objects it needs to interact with: the canvas and the elements manager.
// Crucially, we also pass our `redraw` function as a "callback." This gives `ui.js`
// a "remote control" to trigger a redraw whenever the user does something, without
// `ui.js` needing to know *how* the redraw actually works.
setupUI(canvas, elements, redraw);


// --- 5. GLOBAL EVENT LISTENERS ---

// Listen for the 'wheel' event on the canvas to handle zooming.
canvasElement.addEventListener('wheel', (e) => {
  // Prevent the default browser action for the wheel event (which is usually scrolling the page).
  e.preventDefault();

  // Determine the zoom direction. If deltaY is negative, we're zooming in; otherwise, out.
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  
  // Get the mouse's current position on the screen.
  const mouseX = e.clientX;
  const mouseY = e.clientY;

  // This is the most important step for "zoom to cursor":
  // We calculate the coordinate on the "infinite world" of our canvas that is
  // currently underneath the mouse cursor *before* we apply the zoom.
  const worldPos = canvas.screenToWorld(mouseX, mouseY);

  // Calculate the new scale level for the canvas.
  let newScale = canvas.scale * zoomFactor;

  // Clamp the zoom scale to a reasonable range to prevent zooming too far in or out.
  newScale = Math.max(0.1, Math.min(newScale, 20)); // Min/max zoom levels

  // This is the magic formula for making the zoom centered on the cursor.
  // It adjusts the canvas's top-left offset (pan) based on the new scale
  // to ensure that the `worldPos` we calculated earlier stays in the exact
  // same screen position (`mouseX`, `mouseY`) after the zoom is applied.
  canvas.offsetX = mouseX - worldPos.x * newScale;
  canvas.offsetY = mouseY - worldPos.y * newScale;
  canvas.scale = newScale;

  // After all calculations are done, call redraw() to update the screen.
  redraw();
}, { passive: false }); // {passive: false} is required to allow preventDefault() to work reliably.


// --- 6. INITIAL DRAW ---

// Call redraw() one time when the application first loads.
// This paints the initial state of the canvas (e.g., the background grid).
redraw();