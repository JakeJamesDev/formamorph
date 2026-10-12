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

/** Where this turn's autosave goes, and which of the world's autosaves go with it. */
export interface AutosavePlan {
  /** The autosave the new one overwrites; undefined for a new slot. */
  slotId?: string;
  /** Older autosaves past the limit, deleted once the new one is written: what is left after the setting
   *  was lowered. */
  trim: string[];
}

/**
 * Where this turn's autosave goes: a new slot while the world has fewer than `slots`, else over its oldest,
 * so the last `slots` turns can always be gone back to. A world holding more than `slots` (the setting was
 * lowered) keeps its newest and trims the rest, oldest first.
 */
export function autosavePlan(
  records: SaveRecord[],
  worldName: string | null,
  worldId?: string,
  slots: number = AUTOSAVE_SLOTS,
): AutosavePlan {
  const saves = worldAutosaves(records, worldName, worldId);
  const keep = Math.max(1, Math.floor(slots));
  if (saves.length < keep) return { trim: [] };
  // Of the saves that go, the newest is overwritten and the older ones are deleted.
  const going = saves.slice(0, saves.length - keep + 1);
  return { slotId: going[going.length - 1].id, trim: going.slice(0, -1).map((s) => s.id) };
}

/** An autosave's display name, by the turn it was taken after. */
export function autosaveName(turn: number | undefined): string {
  return turn ? `${AUTOSAVE_NAME} · Turn ${turn}` : AUTOSAVE_NAME;
}
