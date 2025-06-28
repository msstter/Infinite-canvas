/**
 * This function sets up all the user interface event listeners for the application.
 * It acts as the main controller that listens for user input (mouse, keyboard, UI changes)
 * and tells the other modules (canvas, elements) what to do.
 * @param {object} canvas - The canvas instance from canvas.js.
 * @param {object} elements - The elements manager instance from elements.js.
 * @param {function} drawCallback - A function to call whenever the canvas needs to be redrawn (this is the 'redraw' function from app.js).
 */
import { saveCanvas, loadCanvas } from './storage.js';

export function setupUI(canvas, elements, drawCallback) {

  // --- 1. ELEMENT REFERENCES ---
  // Get references to all the HTML elements we need to interact with.
  // This is more efficient than searching for them every time.

  // Main Toolbar
  const tool = document.getElementById('tool');
  const textInput = document.getElementById('textInput');
  const imageInput = document.getElementById('imageInput');

  // Contextual Menu for the "Draw" tool
  const drawOptionsContainer = document.getElementById('draw-options');
  const drawColorInput = document.getElementById('draw-color');
  const brushSizeInput = document.getElementById('brush-size');
  const brushSizeValue = document.getElementById('brush-size-value');
  const eraserButton = document.getElementById('eraser-tool');

  // Contextual Menu for the "Shape" tool
  const shapeOptionsContainer = document.getElementById('shape-options');
  const shapeTypeSelect = document.getElementById('shape-type');
  const shapeColorInput = document.getElementById('shape-color');
  const shapeFillToggle = document.getElementById('shape-fill-toggle');
  const shapeOutlineContainer = document.getElementById('shape-outline-container');
  const shapeOutlineSizeInput = document.getElementById('shape-outline-size');
  const shapeOutlineValue = document.getElementById('shape-outline-value');

  // Contextual Menu for the "Text" Tool
  const textOptionsContainer = document.getElementById('text-options');
  const fontFamilySelect = document.getElementById('font-family');
  const textColorInput = document.getElementById('text-color');
  const boldButton = document.getElementById('bold-button');
  const italicButton = document.getElementById('italic-button');
  const underlineButton = document.getElementById('underline-button');
  const strikethroughButton = document.getElementById('strikethrough-button');

  // Contextual Menu for the "Storage" tool
  const storageOptionsContainer = document.getElementById('storage-options');
  const saveButton = document.getElementById('save-button');
  const loadButton = document.getElementById('load-button');
  const loadInput = document.getElementById('load-input');


  // --- 2. STATE OBJECTS ---
  // These objects hold the current settings for each tool. When a tool is used,
  // we pass its settings object to the elements manager.

  const drawSettings = {
    color: '#000000',
    lineWidth: 2,
    mode: 'draw'
  };
  
  const shapeSettings = {
    shapeType: 'square',
    color: '#000000',
    isFilled: true,
    lineWidth: 2
  };

  const textSettings = {
    fontFamily: 'Arial',
    color: '#0000FF',
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false
  };

  // --- 3. INTERACTION STATE VARIABLES ---
  // These "flag" variables track what the user is currently doing with the mouse.
  // They are essential for knowing whether a mouse movement should pan the canvas,
  // drag an element, or resize an element.

  let isPanning = false;      // Is the user dragging the canvas background?
  let didPan = false;         // Did the user actually move the canvas, or just click?
  let lastX, lastY;           // The last known mouse position, used for panning.

  let draggingElement = null; // The specific element being moved.
  let resizingElement = null; // The specific element being resized.
  let resizingStart = null;   // The world coordinates where the resize began.
  let resizingHandle = null;  // The name of the resize handle being dragged (e.g., 'br', 'tl').
  let offsetX, offsetY;       // The offset from the mouse click to an element's origin.


  // --- 4. MOUSE EVENT LISTENERS ---
  // These are the core of the interactive experience.

  /**
   * Mousedown: Fired when the user presses a mouse button.
   * This is where we determine what action is about to start.
   */
  canvas.canvas.addEventListener('mousedown', (e) => {
    // Priority 1: If the "Draw" tool is active, start drawing immediately.
    if (tool.value === 'draw') {
      canvas.startDrawing(e.clientX, e.clientY, drawSettings);
      drawCallback();
      return; // Stop processing to prevent other actions.
    }

    // Get the mouse position in the canvas's "world" coordinates.
    const pos = canvas.screenToWorld(e.clientX, e.clientY);
    const selected = elements.getSelected();

    // Priority 2: Check if the user clicked on a resize handle of a selected item.
    if (selected && selected._resizeHandles) {
      for (const handle of selected._resizeHandles) {
        if (
          pos.x >= handle.x && pos.x <= handle.x + handle.size &&
          pos.y >= handle.y && pos.y <= handle.y + handle.size
        ) {
          resizingElement = selected;
          resizingStart = { x: pos.x, y: pos.y };
          resizingHandle = handle.name;
          return; // Stop processing, we are now in "resize mode".
        }
      }
    }

    // Priority 3: Check if the user clicked on an existing element.
    const hit = elements.getElementAt(pos.x, pos.y);
    if (hit) {
      elements.selectElement(hit);
      draggingElement = hit;
      // Calculate the difference between the click and the element's top-left corner.
      offsetX = pos.x - hit.x;
      offsetY = pos.y - hit.y;
      drawCallback();
    } else {
      // Priority 4: If nothing else was hit, the user is panning the canvas.
      elements.clearSelection();
      isPanning = true;
      didPan = false; // Reset this for the new drag action.
      lastX = e.clientX;
      lastY = e.clientY;
      drawCallback();
    }
  });

  /**
   * Mousemove: Fired continuously when the user moves the mouse.
   * This is where we update the state based on the action started in mousedown.
   */
  canvas.canvas.addEventListener('mousemove', (e) => {
    // If we are in drawing mode, just continue adding points to the path.
    if (canvas.isDrawing) {
      canvas.continueDrawing(e.clientX, e.clientY);
      drawCallback();
      return;
    }

    const pos = canvas.screenToWorld(e.clientX, e.clientY);

    // If we are resizing an element, calculate the change and update its properties.
    if (resizingElement && resizingHandle) {
      const dx = pos.x - resizingStart.x; // Change in X since last move
      const dy = pos.y - resizingStart.y; // Change in Y since last move
      
      if (resizingElement.type === 'shape') {
        const sizeChangeX = resizingHandle.includes('l') ? -dx : dx;
        const sizeChangeY = resizingHandle.includes('t') ? -dy : dy;
        const sizeChange = Math.abs(sizeChangeX) > Math.abs(sizeChangeY) ? sizeChangeX : sizeChangeY;
        resizingElement.size += sizeChange;
        resizingElement.size = Math.max(5, resizingElement.size);
      } else if (resizingElement.type === 'image') {
        if (resizingHandle.includes('r')) resizingElement.width += dx;
        if (resizingHandle.includes('l')) { resizingElement.width -= dx; resizingElement.x += dx; }
        if (resizingHandle.includes('b')) resizingElement.height += dy;
        if (resizingHandle.includes('t')) { resizingElement.height -= dy; resizingElement.y += dy; }
      } else if (resizingElement.type === 'text') {
        let newSize = resizingElement.fontSize + (dy * (resizingHandle.includes('t') ? -1 : 1));
        resizingElement.fontSize = Math.max(5, newSize);
      }

      resizingStart = { x: pos.x, y: pos.y }; // Update start for next move event.
      drawCallback();
      return;
    }

    // If we are dragging an element, update its position.
    if (draggingElement) {
      draggingElement.x = pos.x - offsetX;
      draggingElement.y = pos.y - offsetY;
      drawCallback();
    } 
    // If we are panning the canvas, update the canvas's offset.
    else if (isPanning) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPan = true; // It's a drag, not a click.
      canvas.offsetX += dx;
      canvas.offsetY += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      drawCallback();
    }
  });

  /**
   * Mouseup: Fired when the user releases the mouse button.
   * This is where we finalize the action and reset the state variables.
   */
  window.addEventListener('mouseup', (e) => {
    // If we were drawing, finish the path and add it to the elements manager.
    if (canvas.isDrawing) {
      const newPath = canvas.finishDrawing();
      elements.addItem(newPath); // addItem also saves the state for undo.
      drawCallback();
      return;
    }

    // If we finished dragging or resizing an element, save the new state for undo.
    if (draggingElement || resizingElement) {
        elements.saveState();
    }

    // Reset all interaction state variables.
    isPanning = false;
    draggingElement = null;
    resizingElement = null;
    resizingStart = null;
    resizingHandle = null;

    const pos = canvas.screenToWorld(e.clientX, e.clientY);

    // If we didn't pan and nothing is selected, it was a simple click.
    // Create a new element based on the active tool.
    if (!didPan && !elements.getSelected()) {
      if (tool.value === 'shape') {
        elements.addShape(pos.x, pos.y, canvas.scale, shapeSettings);
        drawCallback();
      } else if (tool.value === 'text') { // <<< THIS BLOCK CHANGES
        const text = textInput.value.trim();
        if (text) {
          elements.addText(pos.x, pos.y, text, canvas.scale, textSettings);
          drawCallback();
        }
      }
    }
  });

  // --- 5. UI ELEMENT EVENT LISTENERS ---
  // These listeners respond to changes in the control panels.

  /**
   * Fired when the main tool dropdown (Draw, Shape, etc.) is changed.
   * Its job is to show the correct contextual menu.
   */
  tool.addEventListener('change', () => {
    // Show/hide the text and image inputs based on the selected tool.
    textInput.style.display = tool.value === 'text' ? 'inline' : 'none';
    imageInput.style.display = tool.value === 'image' ? 'inline' : 'none';

    // Hide all contextual menus first.
    document.querySelectorAll('.contextual-menu').forEach(menu => {
        menu.classList.remove('visible');
    });

    // Then, show the one that matches the selected tool.
    if (tool.value === 'draw') {
        drawOptionsContainer.classList.add('visible');
    } else if (tool.value === 'shape') {
        shapeOptionsContainer.classList.add('visible');
    } else if (tool.value === 'text') {
        textOptionsContainer.classList.add('visible');
    } else if (tool.value === 'storage') {
    storageOptionsContainer.classList.add('visible');
    }
  });

  // Listeners for the "Draw" tool controls
  drawColorInput.addEventListener('input', (e) => {
    drawSettings.color = e.target.value;
    drawSettings.mode = 'draw'; // Switch back to draw mode if user was using eraser.
    eraserButton.style.backgroundColor = '';
  });
  brushSizeInput.addEventListener('input', (e) => {
    drawSettings.lineWidth = parseInt(e.target.value, 10);
    brushSizeValue.textContent = e.target.value;
  });
  eraserButton.addEventListener('click', () => {
      drawSettings.mode = 'eraser';
      eraserButton.style.backgroundColor = '#a0c4ff'; // Highlight to show it's active.
  });
  
  // Listeners for the "Shape" tool controls
  shapeTypeSelect.addEventListener('change', (e) => shapeSettings.shapeType = e.target.value);
  shapeColorInput.addEventListener('input', (e) => shapeSettings.color = e.target.value);
  shapeOutlineSizeInput.addEventListener('input', (e) => {
    shapeSettings.lineWidth = parseInt(e.target.value, 10);
    shapeOutlineValue.textContent = e.target.value;
  });
  shapeFillToggle.addEventListener('change', (e) => {
    shapeSettings.isFilled = e.target.checked;
    // Only show the outline slider if the shape is not filled.
    shapeOutlineContainer.style.display = e.target.checked ? 'none' : 'flex';
  });

  // Listeners for the "Text" tool controls
  fontFamilySelect.addEventListener('change', (e) => textSettings.fontFamily = e.target.value);
  textColorInput.addEventListener('input', (e) => textSettings.color = e.target.value);
  
  boldButton.addEventListener('click', () => {
      textSettings.isBold = !textSettings.isBold;
      boldButton.classList.toggle('active');
  });
  italicButton.addEventListener('click', () => {
      textSettings.isItalic = !textSettings.isItalic;
      italicButton.classList.toggle('active');
  });
  underlineButton.addEventListener('click', () => {
      textSettings.isUnderline = !textSettings.isUnderline;
      underlineButton.classList.toggle('active');
  });
  strikethroughButton.addEventListener('click', () => {
      textSettings.isStrikethrough = !textSettings.isStrikethrough;
      strikethroughButton.classList.toggle('active');
  });


  // Listener for the image file input
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      // Add the image to the center of the current view.
      const rect = canvas.canvas.getBoundingClientRect();
      const mouseX = rect.left + canvas.canvas.width / 2;
      const mouseY = rect.top + canvas.canvas.height / 2;
      const pos = canvas.screenToWorld(mouseX, mouseY);
      elements.addImage(img, pos.x, pos.y, canvas.scale);
      drawCallback();
    };
    img.src = URL.createObjectURL(file);
  });

  // Listeners for the "Storage" tool controls
  saveButton.addEventListener('click', () => {
    // Get the current items from the elements manager and pass them to be saved.
    saveCanvas(elements.getItems());
  });
  loadButton.addEventListener('click', () => {
    // This button's only job is to programmatically click the hidden file input.
    loadInput.click();
  });
  loadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Call the loadCanvas function from storage.js
    loadCanvas(file, (loadedItems) => {
      // This is the callback function that runs after the file is loaded and parsed.
      // We tell the elements manager to load the new data...
      elements.loadItems(loadedItems);
      // ...and then we trigger a full redraw of the canvas.
      drawCallback();
    });

    // Reset the input's value. This allows the user to load the same file again
    // if they make changes and want to revert, as the 'change' event will fire again.
    e.target.value = null;
  });

  // --- 6. GLOBAL KEYBOARD SHORTCUT LISTENER ---
  window.addEventListener('keydown', (e) => {
    // Ignore shortcuts if the user is typing in an input field.
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    const isCtrlOrCmd = e.ctrlKey || e.metaKey; // Handles Ctrl for Win/Linux, Cmd for Mac

    // Undo (Ctrl+Z or Cmd+Z)
    if (isCtrlOrCmd && e.key === 'z') {
      e.preventDefault(); // Prevent browser's default undo action.
      elements.undo();
      drawCallback();
    }
    // Copy (Ctrl+C or Cmd+C)
    if (isCtrlOrCmd && e.key === 'c') {
      e.preventDefault();
      elements.copySelected();
    }
    // Paste (Ctrl+V or Cmd+V)
    if (isCtrlOrCmd && e.key === 'v') {
      e.preventDefault();
      elements.paste();
      drawCallback();
    }
    // Delete (Delete or Backspace key)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (elements.deleteSelected()) {
        elements.saveState(); // Save the deletion to the undo history.
        drawCallback();
      }
    }
  });
}
