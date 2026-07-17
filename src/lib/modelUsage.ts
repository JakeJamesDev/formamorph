import { getAllSaveRecords } from '@/components/modals/dbUtils';
import type { GameState, SaveRecord } from '@/types';

/**
 * Which saves have a character wearing a given library model, so deleting it can say what it will affect.
 *
 * Only saves can hold a reference: `CharacterData.playerModelId` names a library id, whereas a world's
 * `customPlayerVRM` embeds its own bytes and points at nothing.
 */

const wears = (state: GameState | undefined, modelId: string): boolean =>
  state?.characterData?.playerModelId === modelId;

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
