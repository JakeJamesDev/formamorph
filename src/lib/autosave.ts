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

/** How many autosaves a world keeps; each turn writes the next, then overwrites the oldest. */
export const AUTOSAVE_SLOTS = 5;

/** A world's autosaves, oldest first by their saved time. */
function worldAutosaves(records: SaveRecord[], worldName: string | null, worldId?: string): SaveRecord[] {
  const time = (r: SaveRecord) => Date.parse(r.currentState?.timestamp ?? '') || 0;
  return records
    .filter((r) => r.isAutosave && (worldId ? r.worldId === worldId : (r.currentState?.worldName ?? null) === worldName))
    .sort((a, b) => time(a) - time(b));
}

/**
 * Where this turn's autosave goes: undefined for a new slot while the world has fewer than `slots`, else the
 * id of its oldest autosave, which the new one overwrites. So the last `slots` turns can always be gone back to.
 */
export function autosaveSlotId(
  records: SaveRecord[],
  worldName: string | null,
  worldId?: string,
  slots: number = AUTOSAVE_SLOTS,
): string | undefined {
  const saves = worldAutosaves(records, worldName, worldId);
  return saves.length < slots ? undefined : saves[0].id;
}

/** An autosave's display name, by the turn it was taken after. */
export function autosaveName(turn: number | undefined): string {
  return turn ? `${AUTOSAVE_NAME} · Turn ${turn}` : AUTOSAVE_NAME;
}
