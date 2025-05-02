/**
 * Utility functions for working with the save download web worker
 */

// Generate a unique ID for each worker request
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Store for pending worker requests
const pendingRequests = new Map();

// Create and cache the worker instance
let workerInstance = null;

/**
 * Get or create the save download worker
 * @returns {Worker} The worker instance
 */
const getWorker = () => {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./saveDownloadWorker.js', import.meta.url));
    
    // Set up the message handler
    workerInstance.addEventListener('message', (event) => {
      const { type, id, result, error } = event.data;
      
      // Find the pending request
      const pendingRequest = pendingRequests.get(id);
      if (!pendingRequest) {
        console.warn(`Received response for unknown request ID: ${id}`);
        return;
      }
      
      // Resolve or reject the promise based on the response type
      if (type === 'success') {
        pendingRequest.resolve(result);
      } else if (type === 'error') {
        pendingRequest.reject(new Error(error.message));
      }
      
      // Clean up the pending request
      pendingRequests.delete(id);
    });
  }
  
  return workerInstance;
};

/**
 * Download a save file using the web worker
 * @param {Object} saveData - The save data to download
 * @returns {Promise<Object>} - A promise that resolves with the download information
 */
export const downloadSaveFile = (saveData) => {
  return new Promise((resolve, reject) => {
    try {
      const worker = getWorker();
      const id = generateRequestId();
      
      // Store the promise callbacks
      pendingRequests.set(id, { resolve, reject });
      
      // Send the data to the worker
      worker.postMessage({ saveData, id });
    } catch (error) {
      // Handle any errors in creating or communicating with the worker
      reject(error);
    }
  });
};

/**
 * Terminate the worker when it's no longer needed
 * This can be called when the application is shutting down or when the worker is no longer needed
 */
export const terminateWorker = () => {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    pendingRequests.clear();
  }
};
