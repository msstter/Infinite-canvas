export function setupUI(canvas, elements, drawCallback) {
  // --- Element References ---
  const tool = document.getElementById('tool');
  const textInput = document.getElementById('textInput');
  const imageInput = document.getElementById('imageInput');

  // New references for the contextual "Draw" menu
  const drawOptionsContainer = document.getElementById('draw-options');
  const drawColorInput = document.getElementById('draw-color');
  const brushSizeInput = document.getElementById('brush-size');
  const brushSizeValue = document.getElementById('brush-size-value');
  const eraserButton = document.getElementById('eraser-tool');

  // --- State Variables ---
  let isPanning = false;
  let didPan = false;
  let lastX, lastY;

  let draggingElement = null;
  let resizingElement = null;
  let resizingStart = null;
  let resizingHandle = null;
  let offsetX = 0;
  let offsetY = 0;
  
  // State object to hold current draw settings
  const drawSettings = {
    color: '#000000',
    lineWidth: 2,
    mode: 'draw' // Can be 'draw' or 'eraser'
  };

  // --- MOUSE EVENT LISTENERS ---

  canvas.canvas.addEventListener('mousedown', (e) => {
    // If the "Draw" tool is active, start drawing and ignore everything else
    if (tool.value === 'draw') {
      // Pass the current draw settings to the canvas when starting a path
      canvas.startDrawing(e.clientX, e.clientY, drawSettings);
      drawCallback();
      return; // Stop further processing for this event
    }

    // --- Logic for other tools (Select, Pan, etc.) ---
    const pos = canvas.screenToWorld(e.clientX, e.clientY);
    const selected = elements.getSelected();

    // Check if clicking on a resize handle
    if (selected && selected._resizeHandles) {
      for (const handle of selected._resizeHandles) {
        if (
          pos.x >= handle.x && pos.x <= handle.x + handle.size &&
          pos.y >= handle.y && pos.y <= handle.y + handle.size
        ) {
          resizingElement = selected;
          resizingStart = { x: pos.x, y: pos.y };
          resizingHandle = handle.name;
          return;
        }
      }
    }

    // Check if clicking on an existing element
    const hit = elements.getElementAt(pos.x, pos.y);
    if (hit) {
      elements.selectElement(hit);
      draggingElement = hit;
      offsetX = pos.x - hit.x;
      offsetY = pos.y - hit.y;
      drawCallback();
    } else {
      // If clicking on empty space, start panning
      elements.clearSelection();
      isPanning = true;
      didPan = false;
      lastX = e.clientX;
      lastY = e.clientY;
      drawCallback();
    }
  });

  canvas.canvas.addEventListener('mousemove', (e) => {
    // If we are in the middle of drawing a line, continue it
    if (canvas.isDrawing) {
      canvas.continueDrawing(e.clientX, e.clientY);
      drawCallback();
      return;
    }

    // --- Logic for other tools ---
    const pos = canvas.screenToWorld(e.clientX, e.clientY);

    if (resizingElement && resizingHandle) {
      const dx = pos.x - resizingStart.x;
      const dy = pos.y - resizingStart.y;

      if (resizingElement.type === 'image') {
        if (resizingHandle === 'br' || resizingHandle === 'tr') resizingElement.width += dx;
        else {
          resizingElement.width -= dx;
          resizingElement.x += dx;
        }
        if (resizingHandle === 'br' || resizingHandle === 'bl') resizingElement.height += dy;
        else {
          resizingElement.height -= dy;
          resizingElement.y += dy;
        }
      }

      if (resizingElement.type === 'text') {
        let newSize = resizingElement.fontSize + (dy * (resizingHandle.includes('t') ? -1 : 1));
        resizingElement.fontSize = newSize;
      }

      resizingStart = { x: pos.x, y: pos.y };
      drawCallback();
      return;
    }

    if (draggingElement) {
      draggingElement.x = pos.x - offsetX;
      draggingElement.y = pos.y - offsetY;
      drawCallback();
    } else if (isPanning) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPan = true;
      canvas.offsetX += dx;
      canvas.offsetY += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      drawCallback();
    }
  });

  window.addEventListener('mouseup', (e) => {
    // If we were drawing, finish the path and add it to our elements
    if (canvas.isDrawing) {
      const newPath = canvas.finishDrawing();
      elements.addItem(newPath);
      drawCallback();
      return;
    }

    // --- Logic for other tools ---
    isPanning = false;
    draggingElement = null;
    resizingElement = null;
    resizingStart = null;
    resizingHandle = null;

    const pos = canvas.screenToWorld(e.clientX, e.clientY);

    // If we clicked on an empty space (no panning), create a new element
    if (!didPan && !elements.getSelected()) {
      if (tool.value === 'shape') {
        elements.addShape(pos.x, pos.y, canvas.scale);
        drawCallback();
      } else if (tool.value === 'text') {
        const text = textInput.value.trim();
        if (text) {
          elements.addText(pos.x, pos.y, text, canvas.scale);
          drawCallback();
        }
      }
    }
  });

  // --- UI CONTROL EVENT LISTENERS ---

  tool.addEventListener('change', () => {
    // Show/hide legacy inputs
    textInput.style.display = tool.value === 'text' ? 'inline' : 'none';
    imageInput.style.display = tool.value === 'image' ? 'inline' : 'none';

    // Show/hide contextual menus
    document.querySelectorAll('.contextual-menu').forEach(menu => {
        menu.classList.remove('visible');
    });

    if (tool.value === 'draw') {
        drawOptionsContainer.classList.add('visible');
    }
    // Add more 'else if' statements here for 'shape', 'text', etc. in the future
  });

  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const rect = canvas.canvas.getBoundingClientRect();
      const mouseX = rect.left + canvas.canvas.width / 2;
      const mouseY = rect.top + canvas.canvas.height / 2;
      const pos = canvas.screenToWorld(mouseX, mouseY);
      elements.addImage(img, pos.x, pos.y, canvas.scale);
      drawCallback();
    };
    img.src = URL.createObjectURL(file);
  });

  // Listeners for the new "Draw" controls
  drawColorInput.addEventListener('input', (e) => {
    drawSettings.color = e.target.value;
    drawSettings.mode = 'draw';
    eraserButton.style.backgroundColor = ''; // Un-highlight eraser
  });

  brushSizeInput.addEventListener('input', (e) => {
    drawSettings.lineWidth = parseInt(e.target.value, 10);
    brushSizeValue.textContent = e.target.value;
  });
  
  eraserButton.addEventListener('click', () => {
      drawSettings.mode = 'eraser';
      eraserButton.style.backgroundColor = '#a0c4ff'; // Highlight to show it's active
  });
}