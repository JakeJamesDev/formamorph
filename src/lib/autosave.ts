import type { SaveRecord } from '@/types';

/** The fixed display name of the per-world autosave slot. */
export const AUTOSAVE_NAME = 'Autosave';

/**
 * The id of the existing autosave slot for a world, or undefined if none yet. Matches by `worldId` when the
 * world has one, else by the save's `worldName` (older, folder-less saves). One autosave per world, so the
 * first match wins.
 */
export function findAutosaveId(records: SaveRecord[], worldName: string | null, worldId?: string): string | undefined {
  const match = records.find(
    (r) => r.isAutosave && (worldId ? r.worldId === worldId : (r.currentState?.worldName ?? null) === worldName),
  );
  return match?.id;
}
