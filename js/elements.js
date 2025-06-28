// js/elements.js

/**
 * The Elements class is like the "Data Brain", or Librarian of the application.
 * It knows nothing about drawing, clicks, or the UI. Its only job is to manage the list
 * of items on the canvas, handle the history for undo/redo, and manage the clipboard.
 * It is the single source of truth for all data.
 */
export class ElementsManager {
  /**
   * Initializes a new instance of the ElementsManager.
   */
  constructor() {
    // The main array holding every object (shape, text, etc.) on the canvas.
    this.items = [];
    // A reference to the currently selected item object.
    this.selected = null;

    // --- Undo/Redo Properties ---
    // The history is an array of "snapshots". Each snapshot is a complete copy of the `items` array.
    // We start with one snapshot: an empty array, representing the initial blank canvas state.
    this.history = [[]];
    // This "bookmark" points to our current position in the history array. It starts at 0.
    this.historyIndex = 0;
    
    // --- Copy/Paste Property ---
    // A temporary holder for an item that has been copied.
    this.clipboard = null;
  }

  // --- HISTORY & STATE MANAGEMENT ---

  /**
   * Saves a snapshot of the current canvas items for the undo/redo feature.
   * This should be called every time a change is made (add, delete, move, resize).
   */
  saveState() {
    // If we have 'undone' some actions, any new action should erase the 'future' redo states.
    // This ensures we don't have a confusing, branching history.
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // IMPORTANT: We need to create a deep, "serializable" copy of the items array.
    // JSON.stringify can't handle live HTML elements like an <img> tag.
    const serializableItems = this.items.map(item => {
      // If we find an image item, we create a new object for it that only stores the image's `src` string.
      // This is safe to save as text.
      if (item.type === 'image' && item.img instanceof HTMLImageElement) {
        return { ...item, img: { src: item.img.src } };
      }
      // For all other item types, we can just return them as they are.
      return item;
    });

    // We push the clean, text-safe version of our items into the history.
    // `JSON.parse(JSON.stringify(...))` is a common, quick way to create a deep copy of an object.
    this.history.push(JSON.parse(JSON.stringify(serializableItems)));
    // Finally, we move our history "bookmark" forward to point to this new state.
    this.historyIndex++;
  }

  /**
   * Restores the canvas to the previous state in the history.
   */
  undo() {
    // Make sure we aren't at the very beginning of history (the initial blank canvas).
    if (this.historyIndex > 0) {
      // Move the history bookmark one step back.
      this.historyIndex--;
      
      // Get the saved state from our history.
      const itemsFromHistory = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      
      // "Rehydrate" the items. This is the reverse of what we did in saveState.
      // We loop through the saved items and restore them to full, usable objects.
      this.items = itemsFromHistory.map(item => {
        // If we find a saved image object, we must create a *new*, live `HTMLImageElement`
        // from the `src` string so the canvas knows how to draw it.
        if (item.type === 'image') {
          const img = new Image();
          img.src = item.img.src;
          return { ...item, img: img };
        }
        return item;
      });
      
      // After undoing, nothing should be selected.
      this.clearSelection();
    }
  }

  // --- ELEMENT ACTIONS ---

  /**
   * Deletes the currently selected element from the main `items` array.
   * @returns {boolean} - True if an item was deleted, otherwise false.
   */
  deleteSelected() {
    if (!this.selected) return false;

    // Find the exact index of the selected item in our array.
    const index = this.items.findIndex(item => item === this.selected);

    // If the item was found...
    if (index > -1) {
      this.items.splice(index, 1); // ...remove 1 item at that index.
      this.clearSelection();
      return true; // Return true to signal the UI that a change was made.
    }
    return false;
  }

  /**
   * Copies the selected element's data to the clipboard property.
   */
  copySelected() {
    if (!this.selected) return;

    // We use the same serialization trick for images to ensure the clipboard is JSON-safe.
    let serializableItem = this.selected;
    if (this.selected.type === 'image') {
        serializableItem = { ...this.selected, img: { src: this.selected.img.src } };
    }
    // Deep copy the clean data into the clipboard.
    this.clipboard = JSON.parse(JSON.stringify(serializableItem));
  }

  /**
   * Creates a new element based on the clipboard data and adds it to the canvas.
   */
  paste() {
    if (!this.clipboard) return;

    // Create a new item from the clipboard data.
    const newItemData = JSON.parse(JSON.stringify(this.clipboard));
    
    // Offset the pasted item slightly so it doesn't appear directly on top of the original.
    newItemData.x += 20;
    newItemData.y += 20;

    // "Rehydrate" the image if the pasted item is an image.
    if (newItemData.type === 'image') {
      const img = new Image();
      img.src = newItemData.img.src;
      newItemData.img = img;
    }
    
    // Use the main addItem method to add it to the canvas.
    this.addItem(newItemData);
  }

  // --- ADDING & GETTING ELEMENTS ---

  /**
   * Creates a new shape object with specific settings and adds it to the canvas.
   * This is a "helper" method that constructs the object before passing it to addItem.
   */
  addShape(x, y, scale, settings) {
    const newShape = {
      type: 'shape',
      x,
      y,
      size: 50 / scale, // The initial size is relative to the current zoom level.
      // Use all the properties from the settings object passed by the UI.
      shapeType: settings.shapeType,
      color: settings.color,
      isFilled: settings.isFilled,
      lineWidth: settings.lineWidth / scale // The outline size is also relative to zoom.
    };
    this.addItem(newShape);
  }

  /**
   * Creates a new text object.
   */
  addText(x, y, text, scale, settings) {
    const newText = {
      type: 'text',
      x,
      y,
      text,
      fontSize: 20 / scale, // Keep initial size relative to zoom
      // New properties from the settings object:
      fontFamily: settings.fontFamily,
      color: settings.color,
      isBold: settings.isBold,
      isItalic: settings.isItalic,
      isUnderline: settings.isUnderline,
      isStrikethrough: settings.isStrikethrough
    };
    this.addItem(newText);
  }

  /**
   * Creates a new image object.
   */
  addImage(img, x, y, scale) {
    // Base the initial size on the image's actual dimensions for better proportions.
    const width = img.width / 2;
    const height = img.height / 2;
    const newImage = { type: 'image', img, x, y, width, height };
    this.addItem(newImage);
  }

  /**
   * The main "master" method for adding any new item to the canvas.
   * @param {object} item - The new item object to be added.
   */
  addItem(item) {
    if (item) {
      // 1. Add the item to our main array.
      this.items.push(item);
      // 2. Select the new item so the user can interact with it immediately.
      this.selectElement(item);
      // 3. Save a snapshot of this new state for the Undo feature.
      this.saveState();
    }
  }

  /**
   * A "getter" to safely retrieve the list of all items.
   * @returns {Array} The array of all items on the canvas.
   */
  getItems() {
    return this.items;
  }

  /**
   * Checks if a mouse click at specific coordinates has 'hit' any element on the canvas.
   * @param {number} x - The world-space x-coordinate of the click.
   * @param {number} y - The world-space y-coordinate of the click.
   * @returns {object|null} The topmost item that was hit, or null if no item was hit.
   */
  getElementAt(x, y) {
    // We loop from the end of the array to the beginning to check the topmost elements first.
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.type === 'shape') {
        // For circles/squares, we calculate the distance from the click to the shape's center.
        // If the distance is less than half the size (the radius), it's a hit.
        const dist = Math.sqrt((x - item.x) ** 2 + (y - item.y) ** 2);
        if (dist < item.size / 2) {
            return item;
        }
      } else if (item.type === 'text') {
        // This is a "bounding box" check for text.
        // The `* 0.6` is a rough approximation of average character width.
        const width = item.text.length * item.fontSize * 0.6;
        const height = item.fontSize;
        if (
          x >= item.x && x <= item.x + width &&
          y <= item.y && y >= item.y - height
        ) return item;
      } else if (item.type === 'image') {
        // A simple rectangular bounding box check for images.
        if (
          x >= item.x && x <= item.x + item.width &&
          y >= item.y && y <= item.y + item.height
        ) return item;
      }
    }
    // If the loop finishes without finding anything, we missed.
    return null;
  }
  
  /**
   * Sets the currently selected item.
   * @param {object} item - The item to select.
   */
  selectElement(item) {
    this.selected = item;
  }

  /**
   * Clears the current selection.
   */
  clearSelection() {
    this.selected = null;
  }

  /**
   * A "getter" to safely retrieve the currently selected item.
   * @returns {object|null} The selected item, or null.
   */
  getSelected() {
    return this.selected;
  }
   /**
   * Replaces the entire item list with a new one from a loaded file.
   * @param {Array} newItems - The array of items loaded from a file.
   */
  loadItems(newItems) {
    this.items = newItems;
    this.clearSelection();

    // Reset the history stack to start fresh from this new loaded state.
    // We must serialize the initial history state correctly, just like in saveState,
    // to handle any image objects.
    const serializableItems = this.items.map(item => {
      if (item.type === 'image' && item.img instanceof HTMLImageElement) {
        return { ...item, img: { src: item.img.src } };
      }
      return item;
    });
    this.history = [JSON.parse(JSON.stringify(serializableItems))];
    this.historyIndex = 0;
  }
}