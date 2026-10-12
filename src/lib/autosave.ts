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
export const MAX_AUTOSAVE_SLOTS = 20;

/** A world's autosaves, oldest first by their saved time. */
function worldAutosaves(records: SaveRecord[], worldName: string | null, worldId?: string): SaveRecord[] {
  const time = (r: SaveRecord) => Date.parse(r.currentState?.timestamp ?? '') || 0;
  return records
    .filter((r) => r.isAutosave && (worldId ? r.worldId === worldId : (r.currentState?.worldName ?? null) === worldName))
    .sort((a, b) => time(a) - time(b));
}

/** The turn a save was taken after: one per player-and-narrator message pair, as GameplayContext pages them. */
function saveTurn(record: SaveRecord): number {
  return Math.max(1, Math.ceil((record.messageHistory?.length ?? 0) / 2));
}

/**
 * The world's autosaves to delete once this turn's new one is written, oldest first: every one past the
 * newest `slots - 1`, so the world holds `slots` with the new one. When the newest is of the same `turn`
 * (a regenerate), it is replaced and uses no slot; an older save of that turn, from a rewound branch, stays.
 */
export function autosavesToTrim(
  records: SaveRecord[],
  worldName: string | null,
  worldId?: string,
  slots: number = AUTOSAVE_SLOTS,
  turn?: number,
): string[] {
  const saves = worldAutosaves(records, worldName, worldId);
  const keep = Math.max(1, Math.floor(slots));
  const newest = saves.at(-1);
  const replaced = newest && turn !== undefined && saveTurn(newest) === turn ? [newest] : [];
  const rest = replaced.length ? saves.slice(0, -1) : saves;
  return [...rest.slice(0, Math.max(0, rest.length - keep + 1)), ...replaced].map((s) => s.id);
}

/** An autosave's display name, by the turn it was taken after. */
export function autosaveName(turn: number | undefined): string {
  return turn ? `${AUTOSAVE_NAME} · Turn ${turn}` : AUTOSAVE_NAME;
}
