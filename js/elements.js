export class ElementsManager {
  constructor() {
    this.items = [];
    this.selected = null;
  }

  addShape(x, y, scale) {
    const size = 50 / scale;
    this.items.push({ type: 'shape', x, y, size });
  }

  addText(x, y, text, scale) {
    const fontSize = 20 / scale;
    this.items.push({ type: 'text', x, y, text, fontSize });
  }

  addImage(img, x, y, scale) {
    const width = 100 / scale;
    const height = 100 / scale;
    this.items.push({ type: 'image', img, x, y, width, height });
  }

  getItems() {
    return this.items;
  }

  // 🟡 Check if a point hits any element
  getElementAt(x, y) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.type === 'text') {
        const width = item.text.length * item.fontSize * 0.6;
        const height = item.fontSize;
        if (
          x >= item.x && x <= item.x + width &&
          y <= item.y && y >= item.y - height
        ) return item;
      } else if (item.type === 'image') {
        if (
          x >= item.x && x <= item.x + item.width &&
          y >= item.y && y <= item.y + item.height
        ) return item;
      }
    }
    return null;
  }

  selectElement(item) {
    this.selected = item;
  }

  clearSelection() {
    this.selected = null;
  }

  getSelected() {
    return this.selected;
  }
}
