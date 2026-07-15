/**
 * Web Worker for handling save file conversion
 * This prevents the main thread from freezing when converting large save files
 */
import { flattenNestedGameStates } from './saveConversion';

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  try {
    const { savedData, id } = event.data;
    
    // Check if this is a legacy format that needs conversion
    if (savedData.gameStates && Array.isArray(savedData.gameStates)) {
      // Extract the flattened state history from the nested structure
      const flattenedStates = flattenNestedGameStates(savedData);
      
      // Send the converted data back to the main thread
      self.postMessage({
        type: 'success',
        id,
        result: {
          convertedData: savedData,
          flattenedStates
        }
      });
    } else {
      // If no conversion needed, just pass through the data
      self.postMessage({
        type: 'success',
        id,
        result: {
          convertedData: savedData,
          flattenedStates: []
        }
      });
    }
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      type: 'error',
      id: event.data.id,
      error: {
        message: (error as Error).message,
        stack: (error as Error).stack
      }
    });
  }
});
