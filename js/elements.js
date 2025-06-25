export class ElementsManager {
  constructor() {
    this.items = [];
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
}