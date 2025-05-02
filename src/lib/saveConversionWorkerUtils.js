/**
 * Utility functions for working with the save conversion web worker
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
 * Get or create the save conversion worker
 * @returns {Worker} The worker instance
 */
const getWorker = () => {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./saveConversionWorker.js', import.meta.url));
    
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
 * Convert a save file using the web worker
 * @param {Object} savedData - The save data to convert
 * @returns {Promise<Object>} - A promise that resolves with the converted data
 */
export const convertSaveFile = (savedData) => {
  return new Promise((resolve, reject) => {
    try {
      const worker = getWorker();
      const id = generateRequestId();
      
      // Store the promise callbacks
      pendingRequests.set(id, { resolve, reject });
      
      // Send the data to the worker
      worker.postMessage({ savedData, id });
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
