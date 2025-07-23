"use strict";
(() => {
  // src/matt/notecard.ts
  var Notecard = class {
    element;
    topBar;
    titleSpan;
    // Now a separate property to access
    contentArea;
    // Changed from HTMLTextAreaElement to HTMLDivElement
    constructor(x, y, width = 300, height = 200) {
      this.element = document.createElement("div");
      this.element.classList.add("notecard");
      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;
      this.element.style.width = `${width}px`;
      this.element.style.height = `${height}px`;
      this.topBar = document.createElement("div");
      this.topBar.classList.add("notecard-top-bar");
      this.element.appendChild(this.topBar);
      this.titleSpan = document.createElement("span");
      this.titleSpan.classList.add("notecard-title");
      this.titleSpan.contentEditable = "true";
      this.titleSpan.textContent = "New Notecard";
      this.titleSpan.spellcheck = false;
      this.topBar.appendChild(this.titleSpan);
      this.titleSpan.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.titleSpan.blur();
        }
      });
      const controlsContainer = document.createElement("div");
      controlsContainer.classList.add("notecard-controls");
      this.topBar.appendChild(controlsContainer);
      const fontSelect = document.createElement("select");
      fontSelect.classList.add("notecard-font-select");
      const fonts = ["Courier New", "Arial", "Verdana", "Georgia", "Times New Roman"];
      fonts.forEach((font) => {
        const option = document.createElement("option");
        option.value = font;
        option.textContent = font;
        fontSelect.appendChild(option);
      });
      fontSelect.addEventListener("change", (e) => {
        document.execCommand("fontName", false, e.target.value);
        this.contentArea.focus();
      });
      controlsContainer.appendChild(fontSelect);
      const sizeSelect = document.createElement("select");
      sizeSelect.classList.add("notecard-size-select");
      const sizes = ["1", "2", "3", "4", "5", "6", "7"];
      sizes.forEach((size) => {
        const option = document.createElement("option");
        option.value = size;
        option.textContent = `${parseInt(size) * 3 + 10}px`;
        sizeSelect.appendChild(option);
      });
      sizeSelect.addEventListener("change", (e) => {
        document.execCommand("fontSize", false, e.target.value);
        this.contentArea.focus();
      });
      controlsContainer.appendChild(sizeSelect);
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.classList.add("notecard-color-input");
      colorInput.value = "#333333";
      colorInput.addEventListener("input", (e) => {
        document.execCommand("foreColor", false, e.target.value);
        this.contentArea.focus();
      });
      controlsContainer.appendChild(colorInput);
      const createEmphasisButton = (command, text) => {
        const button = document.createElement("button");
        button.classList.add("notecard-emphasis-button");
        button.textContent = text;
        button.addEventListener("click", () => {
          document.execCommand(command, false, null);
          this.contentArea.focus();
        });
        return button;
      };
      controlsContainer.appendChild(createEmphasisButton("bold", "B"));
      controlsContainer.appendChild(createEmphasisButton("italic", "I"));
      controlsContainer.appendChild(createEmphasisButton("underline", "U"));
      controlsContainer.appendChild(createEmphasisButton("strikeThrough", "S"));
      this.contentArea = document.createElement("div");
      this.contentArea.classList.add("notecard-content");
      this.contentArea.contentEditable = "true";
      this.contentArea.setAttribute("data-placeholder", "Start typing here...");
      this.element.appendChild(this.contentArea);
      this.makeDraggable();
    }
    getElement() {
      return this.element;
    }
    getContent() {
      return this.contentArea.innerHTML;
    }
    setContent(html) {
      this.contentArea.innerHTML = html;
    }
    getTitle() {
      return this.titleSpan.textContent || "";
    }
    setTitle(title) {
      this.titleSpan.textContent = title;
    }
    makeDraggable() {
      let isDragging = false;
      let offsetX, offsetY;
      this.topBar.addEventListener("mousedown", (e) => {
        if (e.target === this.titleSpan || e.target.closest(".notecard-controls")) {
          return;
        }
        isDragging = true;
        offsetX = e.clientX - this.element.getBoundingClientRect().left;
        offsetY = e.clientY - this.element.getBoundingClientRect().top;
        this.element.style.cursor = "grabbing";
        this.element.style.zIndex = "1000";
      });
      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const newX = e.clientX - offsetX;
        const newY = e.clientY - offsetY;
        this.element.style.left = `${newX}px`;
        this.element.style.top = `${newY}px`;
      });
      document.addEventListener("mouseup", () => {
        isDragging = false;
        this.element.style.cursor = "grab";
        this.element.style.zIndex = "auto";
      });
    }
  };
  function initNotecard() {
    const card = new Notecard(20, 20, 250, 200);
    document.body.appendChild(card.getElement());
  }

  // src/matt/app.ts
  initNotecard();
})();
//# sourceMappingURL=app.js.map
