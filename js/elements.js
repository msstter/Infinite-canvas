// js/elements.js (Corrected and Final Version)

export class ElementsManager {
  constructor() {
    this.items = [];
    this.selected = null;
    this.history = [[]]; // Start with an empty canvas state
    this.historyIndex = 0;
    this.clipboard = null;
  }

  // --- HISTORY & STATE MANAGEMENT ---

  saveState() {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    // Create a deep, serializable copy of the items array
    const serializableItems = this.items.map(item => {
      // For images, store the src string instead of the live object
      if (item.type === 'image' && item.img instanceof HTMLImageElement) {
        return { ...item, img: { src: item.img.src } };
      }
      return item;
    });
    this.history.push(JSON.parse(JSON.stringify(serializableItems)));
    this.historyIndex++;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const itemsFromHistory = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      
      // "Rehydrate" the image objects from their src strings
      this.items = itemsFromHistory.map(item => {
        if (item.type === 'image') {
          const img = new Image();
          img.src = item.img.src;
          return { ...item, img: img };
        }
        return item;
      });
      
      this.clearSelection();
    }
  }

  // --- ELEMENT ACTIONS ---

  deleteSelected() {
    if (!this.selected) return false;
    const index = this.items.findIndex(item => item === this.selected);
    if (index > -1) {
      this.items.splice(index, 1);
      this.clearSelection();
      return true;
    }
    return false;
  }

  copySelected() {
    if (!this.selected) return;
    // Use the same serialization logic as saveState for images
    let serializableItem = this.selected;
    if (this.selected.type === 'image') {
        serializableItem = { ...this.selected, img: { src: this.selected.img.src } };
    }
    this.clipboard = JSON.parse(JSON.stringify(serializableItem));
  }

  paste() {
    if (!this.clipboard) return;
    const newItemData = JSON.parse(JSON.stringify(this.clipboard));
    newItemData.x += 20;
    newItemData.y += 20;

    // If it's an image, we need to create a new live Image object
    if (newItemData.type === 'image') {
      const img = new Image();
      img.src = newItemData.img.src;
      newItemData.img = img;
    }
    
    this.addItem(newItemData);
  }

  // --- ADDING & GETTING ELEMENTS ---

  // RESTORED: This is your original working logic with scaling
  addShape(x, y, scale) {
    const size = 50 / scale;
    const newShape = { type: 'shape', x, y, size };
    this.addItem(newShape);
  }

  // RESTORED: This is your original working logic with scaling
  addText(x, y, text, scale) {
    const fontSize = 20 / scale;
    const newText = { type: 'text', x, y, text, fontSize };
    this.addItem(newText);
  }

  // RESTORED: This is your original working logic
  addImage(img, x, y, scale) {
    const width = img.width / 2; // Base size on image's actual dimensions
    const height = img.height / 2;
    const newImage = { type: 'image', img, x, y, width, height };
    this.addItem(newImage);
  }

  // Generic add method that handles saving state
  addItem(item) {
    if (item) {
      this.items.push(item);
      this.selectElement(item);
      this.saveState();
    }
  }

  getItems() {
    return this.items;
  }

  // RESTORED: Your original working text hit-detection, with shape detection added
  getElementAt(x, y) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.type === 'shape') {
        if (x >= item.x - item.size / 2 && x <= item.x + item.size / 2 &&
            y >= item.y - item.size / 2 && y <= item.y + item.size / 2) {
            return item;
        }
      } else if (item.type === 'text') {
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