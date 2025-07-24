// Notecard/Notecard.ts

export class Notecard {
    private element: HTMLDivElement;
    private topBar: HTMLDivElement;
    private titleSpan: HTMLSpanElement; // Now a separate property to access
    private contentArea: HTMLDivElement; // Changed from HTMLTextAreaElement to HTMLDivElement

    constructor(x: number, y: number, width: number = 300, height: number = 200) {
        this.element = document.createElement("div");
        this.element.classList.add("notecard");
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.width = `${width}px`;
        this.element.style.height = `${height}px`;

        this.topBar = document.createElement("div");
        this.topBar.classList.add("notecard-top-bar");
        this.element.appendChild(this.topBar);

        // Editable Title
        this.titleSpan = document.createElement("span");
        this.titleSpan.classList.add("notecard-title");
        this.titleSpan.contentEditable = "true"; // Make it editable
        this.titleSpan.textContent = "New Notecard";
        this.titleSpan.spellcheck = false; // Disable spellcheck for titles
        this.topBar.appendChild(this.titleSpan);

        // Prevent new lines in title
        this.titleSpan.addEventListener("keypress", (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault(); // Prevent new line on Enter
                this.titleSpan.blur(); // Remove focus
            }
        });

        // Add a placeholder for interactive elements (e.g., font controls)
        const controlsContainer = document.createElement("div");
        controlsContainer.classList.add("notecard-controls");
        this.topBar.appendChild(controlsContainer);

        // Font Family Selector
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
            document.execCommand("fontName", false, (e.target as HTMLSelectElement).value);
            this.contentArea.focus(); // Keep focus on content area
        });
        controlsContainer.appendChild(fontSelect);

        // Font Size Selector
        const sizeSelect = document.createElement("select");
        sizeSelect.classList.add("notecard-size-select");
        const sizes = ["1", "2", "3", "4", "5", "6", "7"]; // Corresponds to font sizes 1-7 in execCommand
        sizes.forEach((size) => {
            const option = document.createElement("option");
            option.value = size;
            option.textContent = `${parseInt(size) * 3 + 10}px`; // Approximate px value for display
            sizeSelect.appendChild(option);
        });
        sizeSelect.addEventListener("change", (e) => {
            document.execCommand("fontSize", false, (e.target as HTMLSelectElement).value);
            this.contentArea.focus();
        });
        controlsContainer.appendChild(sizeSelect);

        // Text Color Input
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.classList.add("notecard-color-input");
        colorInput.value = "#333333"; // Default text color
        colorInput.addEventListener("input", (e) => {
            document.execCommand("foreColor", false, (e.target as HTMLInputElement).value);
            this.contentArea.focus();
        });
        controlsContainer.appendChild(colorInput);

        // Typographical Emphasis Buttons
        const createEmphasisButton = (command: string, text: string) => {
            const button = document.createElement("button");
            button.classList.add("notecard-emphasis-button");
            button.textContent = text;
            button.addEventListener("click", () => {
                document.execCommand(command, false);
                this.contentArea.focus(); // Keep focus on content area
            });
            return button;
        };

        controlsContainer.appendChild(createEmphasisButton("bold", "B"));
        controlsContainer.appendChild(createEmphasisButton("italic", "I"));
        controlsContainer.appendChild(createEmphasisButton("underline", "U"));
        controlsContainer.appendChild(createEmphasisButton("strikeThrough", "S"));

        // Content Area (now contentEditable div)
        this.contentArea = document.createElement("div"); // Changed to div
        this.contentArea.classList.add("notecard-content");
        this.contentArea.contentEditable = "true"; // Make it editable
        this.contentArea.setAttribute("data-placeholder", "Start typing here..."); // For CSS placeholder
        this.element.appendChild(this.contentArea);

        // Add event listeners for basic dragging
        this.makeDraggable();
    }

    public getElement(): HTMLDivElement {
        return this.element;
    }

    public getContent(): string {
        return this.contentArea.innerHTML; // Use innerHTML for rich text
    }

    public setContent(html: string): void {
        this.contentArea.innerHTML = html; // Use innerHTML for rich text
    }

    public getTitle(): string {
        return this.titleSpan.textContent || "";
    }

    public setTitle(title: string): void {
        this.titleSpan.textContent = title;
    }

    private makeDraggable(): void {
        let isDragging = false;
        let offsetX: number, offsetY: number;

        // Use topBar for dragging
        this.topBar.addEventListener("mousedown", (e: MouseEvent) => {
            if (e.target === this.titleSpan || (e.target as HTMLElement).closest(".notecard-controls")) {
                // Don't drag if clicking directly on title or controls
                return;
            }
            isDragging = true;
            offsetX = e.clientX - this.element.getBoundingClientRect().left;
            offsetY = e.clientY - this.element.getBoundingClientRect().top;
            this.element.style.cursor = "grabbing";
            this.element.style.zIndex = "1000"; // Bring to front
        });

        document.addEventListener("mousemove", (e: MouseEvent) => {
            if (!isDragging) return;

            const newX = e.clientX - offsetX;
            const newY = e.clientY - offsetY;

            this.element.style.left = `${newX}px`;
            this.element.style.top = `${newY}px`;
        });

        document.addEventListener("mouseup", () => {
            isDragging = false;
            this.element.style.cursor = "grab";
            this.element.style.zIndex = "auto"; // Reset z-index
        });
    }
}

export function initNotecard() {
    const card = new Notecard(20, 20, 508, 304);
    document.body.appendChild(card.getElement());
}
