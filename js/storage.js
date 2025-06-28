// js/storage.js (New and Implemented)

/**
 * Takes an array of canvas items, converts them to a JSON string,
 * and triggers a download of that string as a .json file.
 * @param {Array} items - The array of items from ElementsManager.
 */
export function saveCanvas(items) {
  // We must serialize the items in a way that can be saved.
  // For images, we just save the 'src' string, not the live HTML element.
  const serializableItems = items.map(item => {
    if (item.type === 'image' && item.img instanceof HTMLImageElement) {
      return { ...item, img: { src: item.img.src } };
    }
    return item;
  });

  // Convert the array of objects into a JSON string.
  // The 'null, 2' argument makes the JSON file human-readable.
  const jsonString = JSON.stringify(serializableItems, null, 2);

  // Create a 'Blob' which is a file-like object of the raw data.
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Create a temporary URL that points to the Blob.
  const url = URL.createObjectURL(blob);

  // Create a temporary anchor (<a>) element to trigger the download.
  const a = document.createElement('a');
  a.href = url;
  a.download = 'infinite-canvas-save.json'; // The default filename for the download
  document.body.appendChild(a); // Add the anchor to the page
  a.click(); // Programmatically click the anchor to start the download
  document.body.removeChild(a); // Clean up by removing the anchor

  // Revoke the temporary URL to free up memory.
  URL.revokeObjectURL(url);
}

/**
 * Takes a file uploaded by the user, reads it, and uses a callback
 * to return the parsed array of items.
 * @param {File} file - The .json file selected by the user.
 * @param {Function} callback - The function to call with the loaded items.
 */
export function loadCanvas(file, callback) {
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const jsonString = event.target.result;
      const loadedItems = JSON.parse(jsonString);

      // "Rehydrate" the image objects. The saved file only has the image src,
      // so we need to create new live HTMLImageElement objects.
      const itemsWithImages = loadedItems.map(item => {
        if (item.type === 'image') {
          const img = new Image();
          img.src = item.img.src;
          return { ...item, img: img };
        }
        return item;
      });

      // Pass the fully loaded and prepared items to the callback function.
      callback(itemsWithImages);

    } catch (error) {
      console.error("Error loading or parsing canvas file:", error);
      alert("Failed to load file. It may be corrupted or not a valid canvas file.");
    }
  };

  // Start reading the file as text.
  reader.readAsText(file);
}