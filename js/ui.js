export function setupUI(canvas, elements, drawCallback) {
  // --- ELEMENT REFERENCES ---
  const tool = document.getElementById('tool');
  const textInput = document.getElementById('textInput');
  const imageInput = document.getElementById('imageInput');

  // Draw Menu Elements
  const drawOptionsContainer = document.getElementById('draw-options');
  const drawColorInput = document.getElementById('draw-color');
  const brushSizeInput = document.getElementById('brush-size');
  const brushSizeValue = document.getElementById('brush-size-value');
  const eraserButton = document.getElementById('eraser-tool');

  // ADDED: Shape Menu Elements
  const shapeOptionsContainer = document.getElementById('shape-options');
  const shapeTypeSelect = document.getElementById('shape-type');
  const shapeColorInput = document.getElementById('shape-color');
  const shapeFillToggle = document.getElementById('shape-fill-toggle');
  const shapeOutlineContainer = document.getElementById('shape-outline-container');
  const shapeOutlineSizeInput = document.getElementById('shape-outline-size');
  const shapeOutlineValue = document.getElementById('shape-outline-value');


  // --- STATE OBJECTS ---
  const drawSettings = {
    color: '#000000',
    lineWidth: 2,
    mode: 'draw'
  };
  
  // ADDED: State for the shape tool
  const shapeSettings = {
    shapeType: 'square',
    color: '#000000',
    isFilled: true,
    lineWidth: 2
  };

  // --- INTERACTION STATE VARIABLES ---
  let isPanning = false;
  let didPan = false;
  let lastX, lastY;

  let draggingElement = null;
  let resizingElement = null;
  let resizingStart = null;
  let resizingHandle = null;
  let offsetX = 0;
  let offsetY = 0;

  // --- MOUSE EVENT LISTENERS ---

  canvas.canvas.addEventListener('mousedown', (e) => {
    if (tool.value === 'draw') {
      canvas.startDrawing(e.clientX, e.clientY, drawSettings);
      drawCallback();
      return;
    }

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
    if (canvas.isDrawing) {
      canvas.continueDrawing(e.clientX, e.clientY);
      drawCallback();
      return;
    }

    const pos = canvas.screenToWorld(e.clientX, e.clientY);

    if (resizingElement && resizingHandle) {
      const dx = pos.x - resizingStart.x;
      const dy = pos.y - resizingStart.y;
      
      // ADDED: Logic for resizing shapes
      if (resizingElement.type === 'shape') {
        const sizeChangeX = resizingHandle.includes('l') ? -dx : dx;
        const sizeChangeY = resizingHandle.includes('t') ? -dy : dy;
        const sizeChange = Math.abs(sizeChangeX) > Math.abs(sizeChangeY) ? sizeChangeX : sizeChangeY;
        
        resizingElement.size += sizeChange;
        resizingElement.size = Math.max(5, resizingElement.size); // Prevent tiny shapes
      }

      if (resizingElement.type === 'image') {
        if (resizingHandle.includes('r')) resizingElement.width += dx;
        if (resizingHandle.includes('l')) { resizingElement.width -= dx; resizingElement.x += dx; }
        if (resizingHandle.includes('b')) resizingElement.height += dy;
        if (resizingHandle.includes('t')) { resizingElement.height -= dy; resizingElement.y += dy; }
      }

      if (resizingElement.type === 'text') {
        let newSize = resizingElement.fontSize + (dy * (resizingHandle.includes('t') ? -1 : 1));
        resizingElement.fontSize = Math.max(5, newSize);
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
    if (canvas.isDrawing) {
      const newPath = canvas.finishDrawing();
      elements.addItem(newPath);
      drawCallback();
      return;
    }

    if (draggingElement || resizingElement) {
        elements.saveState();
    }

    isPanning = false;
    draggingElement = null;
    resizingElement = null;
    resizingStart = null;
    resizingHandle = null;

    const pos = canvas.screenToWorld(e.clientX, e.clientY);

    if (!didPan && !elements.getSelected()) {
      // MODIFIED: Call to addShape now passes the settings object
      if (tool.value === 'shape') {
        elements.addShape(pos.x, pos.y, canvas.scale, shapeSettings);
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

  // --- UI ELEMENT LISTENERS ---

  tool.addEventListener('change', () => {
    textInput.style.display = tool.value === 'text' ? 'inline' : 'none';
    imageInput.style.display = tool.value === 'image' ? 'inline' : 'none';

    document.querySelectorAll('.contextual-menu').forEach(menu => {
        menu.classList.remove('visible');
    });

    // MODIFIED: Now shows the shape menu when 'shape' is selected
    if (tool.value === 'draw') {
        drawOptionsContainer.classList.add('visible');
    } else if (tool.value === 'shape') {
        shapeOptionsContainer.classList.add('visible');
    }
  });

  // Draw tool listeners
  drawColorInput.addEventListener('input', (e) => {
    drawSettings.color = e.target.value;
    drawSettings.mode = 'draw';
    eraserButton.style.backgroundColor = '';
  });
  brushSizeInput.addEventListener('input', (e) => {
    drawSettings.lineWidth = parseInt(e.target.value, 10);
    brushSizeValue.textContent = e.target.value;
  });
  eraserButton.addEventListener('click', () => {
      drawSettings.mode = 'eraser';
      eraserButton.style.backgroundColor = '#a0c4ff';
  });
  
  // ADDED: Listeners for all the new shape controls
  shapeTypeSelect.addEventListener('change', (e) => shapeSettings.shapeType = e.target.value);
  shapeColorInput.addEventListener('input', (e) => shapeSettings.color = e.target.value);
  shapeOutlineSizeInput.addEventListener('input', (e) => {
    shapeSettings.lineWidth = parseInt(e.target.value, 10);
    shapeOutlineValue.textContent = e.target.value;
  });
  shapeFillToggle.addEventListener('change', (e) => {
    shapeSettings.isFilled = e.target.checked;
    shapeOutlineContainer.style.display = e.target.checked ? 'none' : 'flex';
  });

  // Image input listener
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

  // --- GLOBAL KEYBOARD SHORTCUT LISTENER ---
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && e.key === 'z') {
      e.preventDefault();
      elements.undo();
      drawCallback();
    }
    if (isCtrlOrCmd && e.key === 'c') {
      e.preventDefault();
      elements.copySelected();
    }
    if (isCtrlOrCmd && e.key === 'v') {
      e.preventDefault();
      elements.paste();
      drawCallback();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (elements.deleteSelected()) {
        elements.saveState();
        drawCallback();
      }
    }
  });
}