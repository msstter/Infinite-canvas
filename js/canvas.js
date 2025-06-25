export class Canvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize = this.resize.bind(this);
    this.selectedItem = null;

    window.addEventListener('resize', this.resize);
    this.resize();
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
    this.clear();
    this.drawBackground();
    const ctx = this.ctx;
    ctx.save();
    this.setTransform();

    for (const item of items) {
      ctx.save();
      if (item.type === 'shape') {
        ctx.fillStyle = 'black';
        ctx.fillRect(item.x - item.size / 2, item.y - item.size / 2, item.size, item.size);
      } else if (item.type === 'text') {
        ctx.fillStyle = 'blue';
        ctx.font = `${item.fontSize}px sans-serif`;
        ctx.fillText(item.text, item.x, item.y);
      } else if (item.type === 'image') {
        ctx.drawImage(item.img, item.x, item.y, item.width, item.height);
      }

      // Draw selection box if selected
      if (item === selectedItem) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;

        if (item.type === 'text') {
          const width = item.text.length * item.fontSize * 0.6;
          const height = item.fontSize;
          ctx.strokeRect(item.x - 2, item.y - height - 2, width + 4, height + 4);
        } else if (item.type === 'image') {
          ctx.strokeRect(item.x - 2, item.y - 2, item.width + 4, item.height + 4);
        }
      }

      if (item === this.selectedItem) {
      // ... (existing selection box code)
        const handleSize = 10 / this.scale;
        const hx = (item.x + (item.width || item.text.length * item.fontSize * 0.6));
        const hy = (item.y + (item.height || 0));
        ctx.fillStyle = 'red';
        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);

        item._resizeHandle = {
          x: hx - handleSize / 2,
          y: hy - handleSize / 2,
          size: handleSize,
        };
    }

      ctx.restore();
    }

    ctx.restore();
  }
}
