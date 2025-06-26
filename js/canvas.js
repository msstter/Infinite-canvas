export class Canvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize = this.resize.bind(this);
    this.selectedItem = null;

    this.isDrawing = false;
    this.currentPath = null;

    window.addEventListener('resize', this.resize);
    this.resize();
  }

  startDrawing(x, y, options) {
    this.isDrawing = true;
    this.currentPath = {
      type: 'path',
      points: [this.screenToWorld(x, y)],
      color: options.color,
      lineWidth: options.lineWidth / this.scale,
      mode: options.mode
    };
  }

  continueDrawing(x, y) {
    if (!this.isDrawing) return;
    this.currentPath.points.push(this.screenToWorld(x, y));
  }

  finishDrawing() {
    this.isDrawing = false;
    const finishedPath = this.currentPath;
    this.currentPath = null;
    if (finishedPath && finishedPath.points.length > 1) {
        return finishedPath;
    }
    return null;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.drawBackground();
  }

  drawBackground() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    const gridSize = 100 * this.scale;
    const startX = this.offsetX % gridSize;
    const startY = this.offsetY % gridSize;

    for (let x = startX; x < this.canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < this.canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setTransform() {
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }

  worldToScreen(x, y) {
    return {
      x: x * this.scale + this.offsetX,
      y: y * this.scale + this.offsetY
    };
  }

  screenToWorld(x, y) {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale
    };
  }

  draw(items, selectedItem = null) {
    this.selectedItem = selectedItem;
    this.clear();
    this.drawBackground();
    const ctx = this.ctx;
    ctx.save();
    this.setTransform();

    const allItems = this.currentPath ? [...items, this.currentPath] : items;

    for (const item of allItems) {
      ctx.save();

      // --- 1. MAIN ITEM RENDERING ---

      if (item.type === 'shape') {
        // REPLACED: This is the new, upgraded block for drawing all shape types
        ctx.fillStyle = item.color;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.lineWidth;

        ctx.beginPath();

        switch (item.shapeType) {
          case 'square':
            ctx.rect(item.x - item.size / 2, item.y - item.size / 2, item.size, item.size);
            break;
          case 'circle':
            ctx.arc(item.x, item.y, item.size / 2, 0, Math.PI * 2);
            break;
          case 'triangle':
            const h = item.size * (Math.sqrt(3) / 2);
            ctx.moveTo(item.x, item.y - h / 2);
            ctx.lineTo(item.x - item.size / 2, item.y + h / 2);
            ctx.lineTo(item.x + item.size / 2, item.y + h / 2);
            ctx.closePath();
            break;
          case 'hexagon':
            const radius = item.size / 2;
            ctx.moveTo(item.x + radius, item.y);
            for (let i = 1; i <= 6; i++) {
              ctx.lineTo(
                item.x + radius * Math.cos(Math.PI / 3 * i),
                item.y + radius * Math.sin(Math.PI / 3 * i)
              );
            }
            break;
        }

        if (item.isFilled) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
      } else if (item.type === 'text') {
        ctx.fillStyle = 'blue';
        ctx.font = `${item.fontSize}px sans-serif`;
        ctx.fillText(item.text, item.x, item.y);
      } else if (item.type === 'image') {
        ctx.drawImage(item.img, item.x, item.y, item.width, item.height);
      } else if (item.type === 'path' && item.points.length > 1) {
        if (item.mode === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
        }
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(item.points[0].x, item.points[0].y);
        for (let i = 1; i < item.points.length; i++) {
          ctx.lineTo(item.points[i].x, item.points[i].y);
        }
        ctx.stroke();
      }

      // --- 2. SELECTION HANDLE RENDERING ---
      if (item === selectedItem) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2 / this.scale;
        const handleSize = 10 / this.scale;
        let width, height, top, left;

        // MODIFIED: Now includes a 'case' for shapes to draw the selection box
        switch (item.type) {
            case 'shape':
                width = item.size;
                height = item.size;
                left = item.x - item.size / 2;
                top = item.y - item.size / 2;
                break;
            case 'text':
                width = item.text.length * item.fontSize * 0.6;
                height = item.fontSize;
                top = item.y - height;
                left = item.x;
                break;
            case 'image':
                width = item.width;
                height = item.height;
                top = item.y;
                left = item.x;
                break;
        }

        if (width && height) {
          ctx.strokeRect(left - 2 / this.scale, top - 2 / this.scale, width + 4 / this.scale, height + 4 / this.scale);
          const corners = [
            { name: 'tl', x: left, y: top },
            { name: 'tr', x: left + width, y: top },
            { name: 'bl', x: left, y: top + height },
            { name: 'br', x: left + width, y: top + height },
          ];
          item._resizeHandles = [];
          for (const corner of corners) {
            ctx.fillStyle = 'red';
            ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
            item._resizeHandles.push({
              name: corner.name,
              x: corner.x - handleSize / 2,
              y: corner.y - handleSize / 2,
              size: handleSize,
            });
          }
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }
}