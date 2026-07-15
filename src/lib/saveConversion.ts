// Pure flatten for the oldest (deep-nested) legacy save shape, shared by the save-conversion worker and its
// tests. A pre-flat save stores each turn nested under the previous turn's `gameStates`; this walks that tree
// into a flat, newest-first-then-children array, stamping `stateVersion: 2` on each extracted snapshot. Field
// migration (trait/body/discovered) is applied separately by migrateLegacySaveState on the load path.

/** A possibly-nested legacy game-state node; fields beyond `gameStates` vary, so they stay loose. */
export type NestedState = { gameStates?: NestedState[] } & Record<string, unknown>;

/** Flatten a nested legacy save into an array of per-turn snapshots (each stripped of its own nesting). */
export function flattenNestedGameStates(nestedState: NestedState | null | undefined, result: NestedState[] = []): NestedState[] {
  if (!nestedState || !nestedState.gameStates || !Array.isArray(nestedState.gameStates)) {
    return result;
  }

  // A copy of this state without the nested gameStates, so it doesn't carry the whole tree.
  const { gameStates, ...stateWithoutNesting } = nestedState;
  stateWithoutNesting.stateVersion = 2;
  result.push(stateWithoutNesting);

  for (const state of gameStates) {
    if (state) {
      flattenNestedGameStates(state, result);
    }
  }

  return result;
}
