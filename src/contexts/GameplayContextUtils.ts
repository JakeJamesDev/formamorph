import { executeStatCode } from '../lib/statCodeExecutor';
import type { Stat } from '@/types';

/** Re-evaluate every stat that has `code`, running each in the sandboxed executor with the full stats
 *  array as context, and return a new array with recomputed values; stats without code pass through.
 *  Pure with respect to the input (works on a copy); executor errors are logged and leave the stat unchanged. */
export const processStatCode = async (stats: Stat[]) => {
  if (!stats || !Array.isArray(stats)) {
    return stats;
  }

  // Create a copy of the stats array to avoid mutation during processing
  const updatedStats = [...stats];

  // Process each stat with code
  const codePromises = updatedStats
    .filter(stat => stat.code && stat.code.trim() !== '')
    .map(async (stat) => {
      try {
        // Execute the code with all stats as context
        const result = await executeStatCode(stat.code!, updatedStats, stat);

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

  // Apply the results to the stats array, tracking whether any value actually moved.
  let changed = false;
  results.forEach(result => {
    if (result) {
      const statIndex = updatedStats.findIndex(s => s.id === result.id);
      if (statIndex !== -1 && updatedStats[statIndex].value !== result.value) {
        updatedStats[statIndex] = {
          ...updatedStats[statIndex],
          value: result.value
        };
        changed = true;
      }
    }
  });

  // Return the original reference when nothing changed, so callers can skip a redundant state update
  // (an unconditional new array made the caller re-set playerStats every turn — double-animating the bars
  // and clobbering regen with a pre-regen baseline).
  return changed ? updatedStats : stats;
};
