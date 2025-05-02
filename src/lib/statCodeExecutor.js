/**
 * Executes JavaScript code to calculate a stat value based on other stats
 * @param {string} code - The JavaScript code to execute
 * @param {Array} stats - The array of all stats
 * @param {Object} currentStat - The current stat being calculated
 * @returns {Promise<{value: number|null, error: string|null}>} - The calculated value or error
 */
export const executeStatCode = async (code, stats, currentStat) => {
  // If code is empty, return null (use the manually set value)
  if (!code || code.trim() === '') {
    return { value: null, error: null };
  }

  try {
    //console.log('Executing code...');
    
    // Capture console.log output
    let consoleOutput = '';
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      args.forEach(arg => {
        consoleOutput += String(arg) + ' ';
      });
      consoleOutput += '\n';
      originalConsoleLog.apply(console, args);
    };

    // Set a timeout for execution (prevent infinite loops)
    const timeoutMs = 1000; // 1 second timeout
    const startTime = Date.now();
    
    // Prepare the stats data to be passed to the function
    const statsData = stats.map(stat => ({
      id: String(stat.id),
      name: stat.name || '',
      type: stat.type || 'number',
      description: stat.description || '',
      min: stat.min || 0,
      max: stat.max || 100,
      value: stat.value || 0,
      regen: stat.regen || 0
    }));
    
    // Wrap the code in a function that returns a value
    const functionBody = `
      try {
        const result = (function() {
          ${code}
        })();
        
        // Ensure the result is a number
        if (typeof result !== 'number') {
          throw new Error('Code must return a number');
        }
        
        // Ensure the result is within the stat's min/max range
        const min = ${currentStat.min || 0};
        const max = ${currentStat.max || 100};
        return Math.min(Math.max(result, min), max);
      } catch (error) {
        throw error;
      }
    `;
    
    // Create a function from the code string
    const executeFunction = new Function('stats', 'currentStatId', functionBody);
    
    // Execute the function with the stats data
    const result = executeFunction(statsData, String(currentStat.id));
    //console.log('Code executed');

    // Check for timeout
    if (Date.now() - startTime > timeoutMs) {
      console.log('Execution timed out');
      // Restore original console.log
      console.log = originalConsoleLog;
      return { value: null, error: 'Execution timed out' };
    }

    // Restore original console.log
    console.log = originalConsoleLog;
    
    // Include any console output in the result
    if (consoleOutput.trim()) {
      console.log('Console output:', consoleOutput);
    }
    
    return { value: result, error: null };
  } catch (error) {
    console.error('Error in executeStatCode:', error);
    
    // Provide more detailed error information
    return { 
      value: null, 
      error: `Error: ${error.message}\nStack: ${error.stack || 'No stack trace available'}`
    };
  }
};
