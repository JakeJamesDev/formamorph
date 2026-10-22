import { getAllSaveRecords } from '@/components/modals/dbUtils';
import type { GameState, SaveRecord } from '@/types';
import type { LegacyCharacterData } from './legacyVrm';

/**
 * Which saves have a character wearing a given library model, so deleting it can say what it will affect.
 *
 * A save names one through its chosen Avatar, or through the old `playerModelId` until a game load remaps it.
 * World store entries embed their own bytes and point at nothing.
 */

const wears = (state: GameState | undefined, modelId: string): boolean => {
  const data = state?.characterData as LegacyCharacterData | null | undefined;
  const pick = data?.chosenVrm?.pick;
  return pick ? pick.kind === 'library' && pick.id === modelId : data?.playerModelId === modelId;
};

/** A save is a match if any of its snapshots names the model — a rollback would put it back on screen. */
const saveUses = (save: SaveRecord, modelId: string): boolean =>
  wears(save.currentState, modelId) || (save.stateHistory ?? []).some((state) => wears(state, modelId));

/**
 * Names of the saves referencing `modelId`, in store order. Returns `[]` rather than throwing if the save
 * database can't be read: this only sharpens a warning, and failing to read it must not block a delete.
 */
export async function findSavesUsingModel(modelId: string): Promise<string[]> {
  try {
    const saves = await getAllSaveRecords();
    return saves.filter((save) => saveUses(save, modelId)).map((save) => save.name);
  } catch {
    return [];
  }
}
