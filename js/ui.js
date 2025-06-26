// ui.js (Updated)

export function setupUI(canvas, elements, drawCallback) {
  const tool = document.getElementById('tool');
  const textInput = document.getElementById('textInput');
  const imageInput = document.getElementById('imageInput');

  let isPanning = false; // Changed from isDragging for clarity
  let didPan = false;    // Changed from dragged for clarity
  let lastX, lastY;

  let draggingElement = null;
  let resizingElement = null;
  let resizingStart = null;
  let resizingHandle = null;
  let offsetX = 0;
  let offsetY = 0;

  canvas.canvas.addEventListener('mousedown', (e) => {
    // --- NEW: Handle Draw Tool ---
    if (tool.value === 'draw') {
      canvas.startDrawing(e.clientX, e.clientY);
      drawCallback();
      return; // Stop further processing for this event
    }
    // --- End New ---

    const pos = canvas.screenToWorld(e.clientX, e.clientY);
    const selected = elements.getSelected();

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

    const hit = elements.getElementAt(pos.x, pos.y);
    if (hit) {
      elements.selectElement(hit);
      draggingElement = hit;
      offsetX = pos.x - hit.x;
      offsetY = pos.y - hit.y;
      drawCallback();
    } else {
      elements.clearSelection();
      isPanning = true;
      didPan = false;
      lastX = e.clientX;
      lastY = e.clientY;
      drawCallback();
    }
  });

  canvas.canvas.addEventListener('mousemove', (e) => {
    // --- NEW: Handle Draw Tool ---
    if (canvas.isDrawing) {
      canvas.continueDrawing(e.clientX, e.clientY);
      drawCallback();
      return; // Stop further processing
    }
    // --- End New ---

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
        resizingElement.fontSize = newSize; // No more size limit
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

  // Attach to window to catch mouseup events even if cursor leaves the canvas
  window.addEventListener('mouseup', (e) => {
    // --- NEW: Handle Draw Tool ---
    if (canvas.isDrawing) {
      const newPath = canvas.finishDrawing();
      elements.addItem(newPath); // Use the new generic method
      drawCallback();
      return; // Stop further processing
    }
    // --- End New ---

    isPanning = false;
    draggingElement = null;
    resizingElement = null;
    resizingStart = null;
    resizingHandle = null;

    const pos = canvas.screenToWorld(e.clientX, e.clientY);

    // Changed condition: only create element if we didn't pan the canvas
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

  tool.addEventListener('change', () => {
    textInput.style.display = tool.value === 'text' ? 'inline' : 'none';
    imageInput.style.display = tool.value === 'image' ? 'inline' : 'none';
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
}