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

/** How many autosaves a world keeps by default: one, overwritten each turn. The Autosaves Kept setting
 *  raises it. */
export const AUTOSAVE_SLOTS = 1;
/** The most the setting allows. */
export const MAX_AUTOSAVE_SLOTS = 50;

/** A world's autosaves, oldest first by their saved time. */
function worldAutosaves(records: SaveRecord[], worldName: string | null, worldId?: string): SaveRecord[] {
  const time = (r: SaveRecord) => Date.parse(r.currentState?.timestamp ?? '') || 0;
  return records
    .filter((r) => r.isAutosave && (worldId ? r.worldId === worldId : (r.currentState?.worldName ?? null) === worldName))
    .sort((a, b) => time(a) - time(b));
}

/**
 * The world's autosaves to delete once this turn's new one is written, oldest first: every one past the
 * newest `slots - 1`, so the world holds `slots` with the new one.
 */
export function autosavesToTrim(
  records: SaveRecord[],
  worldName: string | null,
  worldId?: string,
  slots: number = AUTOSAVE_SLOTS,
): string[] {
  const saves = worldAutosaves(records, worldName, worldId);
  const keep = Math.max(1, Math.floor(slots));
  return saves.slice(0, Math.max(0, saves.length - keep + 1)).map((s) => s.id);
}

/** An autosave's display name, by the turn it was taken after. */
export function autosaveName(turn: number | undefined): string {
  return turn ? `${AUTOSAVE_NAME} · Turn ${turn}` : AUTOSAVE_NAME;
}
