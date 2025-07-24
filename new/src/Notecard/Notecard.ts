// Notecard/Notecard.ts

export class Notecard {
    private element: HTMLDivElement;
    private topBar: HTMLDivElement;
    private titleSpan: HTMLSpanElement;
    private contentArea: HTMLDivElement; // Declared here
    private deleteButton: HTMLButtonElement; 

    constructor(x: number, y: number, width: number = 300, height: number = 200, onDelete: (notecard: Notecard) => void = ()=> {}) {
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
        this.titleSpan.contentEditable = "true";
        this.titleSpan.textContent = "New Notecard";
        this.titleSpan.spellcheck = false;
        this.topBar.appendChild(this.titleSpan);

        // Prevent new lines in title
        this.titleSpan.addEventListener("keypress", (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.titleSpan.blur();
            }
        });

        // Add a placeholder for interactive elements (e.g., font controls)
        const controlsContainer = document.createElement("div");
        controlsContainer.classList.add("notecard-controls");
        // controlsContainer will be appended later within the topBar, after title and before delete button

        // Delete Button
        this.deleteButton = document.createElement("button");
        this.deleteButton.classList.add("notecard-delete-button");
        this.deleteButton.textContent = "X";
        this.deleteButton.title = "Delete Notecard";
        this.deleteButton.addEventListener("click", () => {
            if (onDelete) {
                onDelete(this);
            }
            this.element.remove();
        });
        this.topBar.appendChild(this.deleteButton); // Append delete button to the topBar

        // --- IMPORTANT: CONTENT AREA INITIALIZATION MUST BE HERE ---
        // Content Area (now contentEditable div)
        this.contentArea = document.createElement("div");
        this.contentArea.classList.add("notecard-content");
        this.contentArea.contentEditable = "true";
        this.contentArea.setAttribute("data-placeholder", "Start typing here...");
        this.element.appendChild(this.contentArea); // Appended to the main notecard element

        // Now append controlsContainer to topBar - this is logically where it fits
        // The order here (title, controlsContainer, deleteButton) will be laid out by flexbox.
        // Inserting it before the delete button using insertBefore is precise.
        this.topBar.insertBefore(controlsContainer, this.deleteButton);


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
            this.contentArea.focus();
        });
        controlsContainer.appendChild(fontSelect);

        // Font Size Selector
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
            document.execCommand("fontSize", false, (e.target as HTMLSelectElement).value);
            this.contentArea.focus();
        });
        controlsContainer.appendChild(sizeSelect);

        // Text Color Input
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.classList.add("notecard-color-input");
        colorInput.value = "#333333";
        colorInput.addEventListener("input", (e) => {
            document.execCommand("foreColor", false, (e.target as HTMLInputElement).value);
            this.contentArea.focus();
        });
        controlsContainer.appendChild(colorInput);

        // Typographical Emphasis Buttons - this function is now safe to call
        const createEmphasisButton = (command: string, text: string) => {
            const button = document.createElement("button");
            button.classList.add("notecard-emphasis-button");
            button.textContent = text;

            // This line should now work correctly because this.contentArea is defined
            this.contentArea.addEventListener("selectionchange", () => {
                if (document.queryCommandState(command)) {
                    button.classList.add("active-style");
                } else {
                    button.classList.remove("active-style");
                }
            });

            button.addEventListener("click", () => {
                document.execCommand(command, false);
                this.contentArea.focus();
            });
            return button;
        };

        controlsContainer.appendChild(createEmphasisButton("bold", "B"));
        controlsContainer.appendChild(createEmphasisButton("italic", "I"));
        controlsContainer.appendChild(createEmphasisButton("underline", "U"));
        controlsContainer.appendChild(createEmphasisButton("strikeThrough", "S"));

        // Add event listeners for basic dragging
        this.makeDraggable();
    }

    // ... (rest of the Notecard class methods)
    public getElement(): HTMLDivElement {
        return this.element;
    }

    public getContent(): string {
        return this.contentArea.innerHTML;
    }

    public setContent(html: string): void {
        this.contentArea.innerHTML = html;
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

        this.topBar.addEventListener("mousedown", (e: MouseEvent) => {
            if (e.target === this.titleSpan || (e.target as HTMLElement).closest(".notecard-controls") || e.target === this.deleteButton) {
                return;
            }
            isDragging = true;
            offsetX = e.clientX - this.element.getBoundingClientRect().left;
            offsetY = e.clientY - this.element.getBoundingClientRect().top;
            this.element.style.cursor = "grabbing";
            this.element.style.zIndex = "1000";
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
            this.element.style.zIndex = "auto";
        });
    }
}

// export function initNotecard() is likely no longer used directly in app.ts
// if NotecardOverlay is managing card creation.