/**
 * Web Worker for handling save file downloads
 * This prevents the main thread from freezing when downloading large save files
 */

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  try {
    const { saveData, id } = event.data;
    
    // Create a Blob from the save data
    const blob = new Blob([JSON.stringify(saveData, null, 2)], {type: 'application/json'});
    
    // Use FileReader to read the blob as a data URL
    const reader = new FileReader();
    reader.onload = function() {
      // Send the data URL back to the main thread
      self.postMessage({
        type: 'success',
        id,
        result: {
          dataUrl: reader.result,
          fileName: saveData.name || 'save.json'
        }
      });
    };
    
    reader.onerror = function() {
      self.postMessage({
        type: 'error',
        id,
        error: {
          message: 'Failed to read save data',
          stack: null
        }
      });
    };
    
    // Read the blob as a data URL
    reader.readAsDataURL(blob);
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      type: 'error',
      id: event.data.id,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});
