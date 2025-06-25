export function setupUI(canvas, elements, drawCallback) {
  const tool = document.getElementById('tool');
  const textInput = document.getElementById('textInput');
  const imageInput = document.getElementById('imageInput');

  let isDragging = false;
  let dragged = false;
  let lastX, lastY;

  let draggingElement = null;
  let offsetX = 0;
  let offsetY = 0;

  canvas.canvas.addEventListener('mousedown', (e) => {
    const pos = canvas.screenToWorld(e.clientX, e.clientY);
    const hit = elements.getElementAt(pos.x, pos.y);

    if (hit && (hit.type === 'text' || hit.type === 'image')) {
      elements.selectElement(hit);
      draggingElement = hit;
      offsetX = pos.x - hit.x;
      offsetY = pos.y - hit.y;
      drawCallback();
    } else {
      elements.clearSelection();
      drawCallback();
      isDragging = true;
      dragged = false;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  canvas.canvas.addEventListener('mousemove', (e) => {
    if (draggingElement) {
      const pos = canvas.screenToWorld(e.clientX, e.clientY);
      draggingElement.x = pos.x - offsetX;
      draggingElement.y = pos.y - offsetY;
      drawCallback();
    } else if (isDragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragged = true;
      canvas.offsetX += dx;
      canvas.offsetY += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      drawCallback();
    }
  });

  canvas.canvas.addEventListener('mouseup', (e) => {
    isDragging = false;

    if (draggingElement) {
      draggingElement = null;
      return;
    }

    if (!dragged) {
      const pos = canvas.screenToWorld(e.clientX, e.clientY);
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