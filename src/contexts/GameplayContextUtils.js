import { executeStatCode } from '../lib/statCodeExecutor';

/**
 * Processes stats with dynamic code and updates their values
 * @param {Array} stats - The array of all stats
 * @returns {Promise<Array>} - The updated stats array
 */
export const processStatCode = async (stats) => {
  if (!stats || !Array.isArray(stats)) {
    return stats;
  }

  // Create a copy of the stats array to avoid mutation during processing
  const updatedStats = [...stats];
  
  // Process each stat with code
  const codePromises = updatedStats
    .filter(stat => stat.code && stat.code.trim() !== '')
    .map(async (stat) => {
      console.log("STAT CODE: ")
      console.log(stat.code);
      try {
        // Execute the code with all stats as context
        const result = await executeStatCode(stat.code, updatedStats, stat);
        
        if (result.error) {
          console.error(`Error executing code for stat ${stat.name}:`, result.error);
          return null;
        }
        
        if (result.value !== null) {
          // Return the stat ID and new value
          return { id: stat.id, value: result.value };
        }
      } catch (error) {
        console.error(`Error processing code for stat ${stat.name}:`, error);
      }
      return null;
    });
  
  // Wait for all code executions to complete
  const results = await Promise.all(codePromises);
  
  // Apply the results to the stats array
  results.forEach(result => {
    if (result) {
      const statIndex = updatedStats.findIndex(s => s.id === result.id);
      if (statIndex !== -1) {
        updatedStats[statIndex] = {
          ...updatedStats[statIndex],
          value: result.value
        };
      }
    }
  });
  
  return updatedStats;
};
