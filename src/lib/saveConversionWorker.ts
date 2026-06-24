/**
 * Web Worker for handling save file conversion
 * This prevents the main thread from freezing when converting large save files
 */

// Helper function to extract a flattened array of game states from a nested structure
function flattenNestedGameStates(nestedState, result = []) {
  if (!nestedState || !nestedState.gameStates || !Array.isArray(nestedState.gameStates)) {
    return result;
  }
  
  // Create a version of this state without the nested gameStates to avoid recursion
  const { gameStates, ...stateWithoutNesting } = nestedState;
  
  // Add state version flag
  stateWithoutNesting.stateVersion = 2;
  
  // Add this state to the result array
  result.push(stateWithoutNesting);
  
  // Process each state in the gameStates array
  for (const state of gameStates) {
    if (state) {
      flattenNestedGameStates(state, result);
    }
  }
  
  return result;
}

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
        message: error.message,
        stack: error.stack
      }
    });
  }
});
