/**
 * This Canvas acts as the "Artist" of the application.
 * The Artist is responsible for EVERYTHING related to drawing on the HTML5 canvas.
 * It manages the canvas's state (like pan and zoom) and contains all the logic
 * for rendering shapes, text, images, and paths.
 * It knows nothing about UI events or data management; it just paints what it's told.
 */
export class Canvas {
  /**
   * Sets up the canvas when a new instance is created.
   * @param {HTMLCanvasElement} canvasElement - The <canvas> element from the HTML file.
   */
  constructor(canvasElement) {
    // Core canvas properties
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d'); // The 2D drawing context, where all the drawing commands live

    // State for panning and zooming (the "camera")
    this.scale = 1;      // Current zoom level
    this.offsetX = 0;    // Current horizontal pan
    this.offsetY = 0;    // Current vertical pan

    // State for the currently selected item (for drawing selection handles)
    this.selectedItem = null;

    // State for live-drawing a path with the mouse
    this.isDrawing = false;      // Is the mouse button currently down?
    this.currentPath = null;   // A temporary object to hold the path being drawn

    // .bind(this) ensures that when resize() is called by the event listener,
    // 'this' inside the resize method still refers to the Canvas instance.
    this.resize = this.resize.bind(this);

    // Initial setup
    window.addEventListener('resize', this.resize); // Recalculate size if the window changes
    this.resize(); // Set the initial size
  }

  // --- LIVE DRAWING METHODS ---

  /**
   * Called on mousedown when the Draw tool is active. Begins a new path.
   * @param {number} x - The screen x-coordinate of the mouse.
   * @param {number} y - The screen y-coordinate of the mouse.
   * @param {object} options - Settings from the UI (color, lineWidth, mode).
   */
  startDrawing(x, y, options) {
    this.isDrawing = true;
    // Create a temporary object to store all the data for the line we are currently drawing
    this.currentPath = {
      type: 'path',
      points: [this.screenToWorld(x, y)], // Convert the first point to canvas "world" coordinates
      color: options.color,
      // "Bake in" the current zoom level to the line width.
      // This makes the line's thickness relative to the canvas, not the screen.
      lineWidth: options.lineWidth / this.scale,
      mode: options.mode // 'draw' or 'eraser'
    };
  }

  /**
   * Called on mousemove while drawing. Adds a new point to the current path.
   */
  continueDrawing(x, y) {
    if (!this.isDrawing) return; // Only run if the mouse is down
    this.currentPath.points.push(this.screenToWorld(x, y));
  }

  /**
   * Called on mouseup. Finalizes the path and returns it to be stored permanently.
   */
  finishDrawing() {
    this.isDrawing = false;
    const finishedPath = this.currentPath;
    this.currentPath = null; // Clear the temporary path

    // Only return a path if it has more than one point (i.e., not just a single click)
    if (finishedPath && finishedPath.points.length > 1) {
        return finishedPath;
    }
    return null; // Otherwise, return nothing
  }


  // --- CANVAS MAINTENANCE ---

  /**
   * Resizes the canvas to fill the entire browser window.
   */
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.drawBackground(); // Redraw the background after resizing
  }

  /**
   * Draws the background grid. The math here creates an infinitely repeating grid effect
   * that respects the current pan and zoom.
   */
  drawBackground() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    const gridSize = 100 * this.scale; // Grid size adjusts with zoom
    // Use the modulo operator (%) to calculate the starting point of the grid,
    // creating the illusion of an infinite surface.
    const startX = this.offsetX % gridSize;
    const startY = this.offsetY % gridSize;

    // Draw vertical lines
    for (let x = startX; x < this.canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    // Draw horizontal lines
    for (let y = startY; y < this.canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Wipes the canvas clean. Called at the beginning of every new frame.
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Applies the current pan and zoom to the canvas context. All subsequent
   * drawing operations will be affected by this transformation.
   */
  setTransform() {
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }


  // --- COORDINATE CONVERSION ---

  /**
   * Converts coordinates from the canvas's internal "world space" to the
   * browser's pixel-based "screen space".
   */
  worldToScreen(x, y) {
    return {
      x: x * this.scale + this.offsetX,
      y: y * this.scale + this.offsetY
    };
  }

  /**
   * Converts coordinates from the browser's "screen space" (e.g., a mouse click)
   * to the canvas's internal "world space". This is crucial for knowing
   * WHERE on the infinite canvas the user has interacted.
   */
  screenToWorld(x, y) {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale
    };
  }


  // --- THE MAIN RENDER METHOD ---

  /**
   * This is the heart of the renderer. It takes a list of all items and draws
   * them to the canvas in a single frame.
   * @param {Array} items - The array of all items to draw from elements.js.
   * @param {object | null} selectedItem - The currently selected item, if any.
   */
  draw(items, selectedItem = null) {
    this.selectedItem = selectedItem;
    
    // 1. Prepare the canvas for the new frame
    this.clear();
    this.drawBackground();
    const ctx = this.ctx;
    ctx.save(); // Save the default state (no pan/zoom)
    this.setTransform(); // Apply the current pan/zoom

    // This clever line temporarily adds the path being drawn to the list of items,
    // creating a live preview for the user.
    const allItems = this.currentPath ? [...items, this.currentPath] : items;

    // 2. Loop through every single item and draw it
    for (const item of allItems) {
      // Save the canvas state before drawing each item. This isolates styles (like color)
      // so one item's style doesn't "leak" to the next.
      ctx.save();

      // --- RENDER EACH ITEM BASED ON ITS TYPE ---
      if (item.type === 'shape') {
        ctx.fillStyle = item.color;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.lineWidth; // This is the world-space width, it scales naturally
        ctx.beginPath();
        switch (item.shapeType) {
          case 'square':
            ctx.rect(item.x - item.size / 2, item.y - item.size / 2, item.size, item.size);
            break;
          case 'circle':
            ctx.arc(item.x, item.y, item.size / 2, 0, Math.PI * 2);
            break;
          case 'triangle':
            // Calculate the height of an equilateral triangle based on its side length (size)
            const h = item.size * (Math.sqrt(3) / 2);
            ctx.moveTo(item.x, item.y - h / 2); // Top vertex
            ctx.lineTo(item.x - item.size / 2, item.y + h / 2); // Bottom-left vertex
            ctx.lineTo(item.x + item.size / 2, item.y + h / 2); // Bottom-right vertex
            ctx.closePath(); // Connect back to the top
            break;
          case 'hexagon':
            const radius = item.size / 2;
            ctx.moveTo(item.x + radius, item.y); // Start at the right-most point
            // Loop 6 times, drawing a line to each vertex using trigonometry
            for (let i = 1; i <= 6; i++) {
              ctx.lineTo(
                item.x + radius * Math.cos(Math.PI / 3 * i),
                item.y + radius * Math.sin(Math.PI / 3 * i)
              );
            }
            break;
        }
        // Render the shape as either filled or just an outline
        if (item.isFilled) {
          ctx.fill();
        } else {
          ctx.stroke();
        }

      } else if (item.type === 'text') {
        // --- 1. Set up styles from the item's properties ---
        ctx.fillStyle = item.color || 'blue'; // Use saved color, fallback to blue
        // Dynamically build the font string
        const bold = item.isBold ? 'bold' : '';
        const italic = item.isItalic ? 'italic' : '';
        ctx.font = `${italic} ${bold} ${item.fontSize}px ${item.fontFamily}`;
        // --- Draw the text ---
        ctx.fillText(item.text, item.x, item.y);
        // --- Manually draw Underline and Strikethrough if needed ---
        if (item.isUnderline || item.isStrikethrough) {
          // Measure the text to know how long to make the line
          const metrics = ctx.measureText(item.text);
          const textWidth = metrics.width;
          ctx.strokeStyle = item.color; // Match the text color
          ctx.lineWidth = item.fontSize / 15; // Make line thickness relative to font size
          // Draw Underline
          if (item.isUnderline) {
            ctx.beginPath();
            // Position the line slightly below the text baseline
            const yPos = item.y + 2; 
            ctx.moveTo(item.x, yPos);
            ctx.lineTo(item.x + textWidth, yPos);
            ctx.stroke();
          }
          // Draw Strikethrough
          if (item.isStrikethrough) {
            ctx.beginPath();
            // Position the line in the middle of the text
            const yPos = item.y - item.fontSize / 4;
            ctx.moveTo(item.x, yPos);
            ctx.lineTo(item.x + textWidth, yPos);
            ctx.stroke();
          }
        }

      } else if (item.type === 'image') {
        ctx.drawImage(item.img, item.x, item.y, item.width, item.height);
      } else if (item.type === 'path' && item.points.length > 1) {
        // For the eraser, this special operation makes strokes "cut out" what's below them.
        if (item.mode === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
        }
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.lineWidth;
        ctx.lineCap = 'round'; // Smooth line ends
        ctx.lineJoin = 'round'; // Smooth line corners
        ctx.beginPath();
        ctx.moveTo(item.points[0].x, item.points[0].y);
        // Draw a line connecting all the points in the path
        for (let i = 1; i < item.points.length; i++) {
          ctx.lineTo(item.points[i].x, item.points[i].y);
        }
        ctx.stroke();
      }

      // --- RENDER SELECTION HANDLES ---
      // This block only runs if the current item in the loop is the selected one.
      if (item === selectedItem) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2 / this.scale; // Keep selection line width constant on screen
        const handleSize = 10 / this.scale; // Keep handle size constant on screen
        let width, height, top, left;

        // Calculate the bounding box for the selected item
        switch (item.type) {
            case 'shape':
                width = item.size;
                height = item.size;
                left = item.x - item.size / 2;
                top = item.y - item.size / 2;
                break;
            case 'text':
                width = item.text.length * item.fontSize * 0.6; // Approximation
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

        // If a bounding box was successfully calculated, draw it and the handles
        if (width && height) {
          // Draw the main red rectangle
          ctx.strokeRect(left - 2 / this.scale, top - 2 / this.scale, width + 4 / this.scale, height + 4 / this.scale);
          
          const corners = [
            { name: 'tl', x: left, y: top },
            { name: 'tr', x: left + width, y: top },
            { name: 'bl', x: left, y: top + height },
            { name: 'br', x: left + width, y: top + height },
          ];

          // We create this special property on the item object itself. ui.js will read this
          // property to know where to detect clicks for resizing.
          item._resizeHandles = [];
          for (const corner of corners) {
            ctx.fillStyle = 'red';
            ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
            // Store the calculated handle position for click detection later
            item._resizeHandles.push({
              name: corner.name,
              x: corner.x - handleSize / 2,
              y: corner.y - handleSize / 2,
              size: handleSize,
            });
          }
        }
      }
      
      // Restore the canvas state, undoing any styles or transforms from this specific item
      ctx.restore();
    }

    // Restore the canvas state back to the default (no pan/zoom)
    ctx.restore();
  }
}