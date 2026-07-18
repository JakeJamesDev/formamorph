// The bundled default worlds, plus the record of which ones the player has deleted.
//
// Deleting a default used to be undone on the next Main Menu mount: the seeder decides purely on presence, so
// an absent default is indistinguishable from a never-seeded one and gets re-created. The tombstone below is
// what tells those two states apart.

/** A built-in world to seed on first run; its JSON is imported from `../defaultworlds/<id>.json`. */
export interface DefaultWorldSeed {
  id: string;
  defaultName: string;
}

/** The bundled defaults. Shared so the seeder, the delete path, and the UI all agree on what "default" means. */
export const DEFAULT_WORLDS: DefaultWorldSeed[] = [
  { id: 'rampage', defaultName: 'City Rampage' },
  { id: 'valentines', defaultName: 'Valentines Survival' },
  { id: 'drone', defaultName: 'Reincarnated Drone' },
];

export const isDefaultWorldId = (id: string): boolean => DEFAULT_WORLDS.some((w) => w.id === id);

/** Local-only; never exported with a world or save. */
const DELETED_DEFAULTS_KEY = 'FORMAMORPH_deletedDefaultWorlds';

/** Ids of default worlds the player deleted. A malformed/absent value reads as "none deleted". */
export function readDeletedDefaultWorlds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_DEFAULTS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Record that the player deleted a default world, so the seeder leaves it alone from now on — including when
 * the bundled copy later changes. Undone only by `clearDeletedDefaultWorlds` (Settings → Accessibility).
 */
export function tombstoneDefaultWorld(id: string): void {
  if (!isDefaultWorldId(id)) return;
  const deleted = readDeletedDefaultWorlds();
  if (deleted.has(id)) return;
  deleted.add(id);
  try {
    localStorage.setItem(DELETED_DEFAULTS_KEY, JSON.stringify([...deleted]));
  } catch {
    // A full/blocked localStorage only costs us the tombstone — the delete itself already happened.
  }
}

/** Forget every deletion, so the next seed pass re-creates the missing defaults. The escape hatch behind
 *  Settings → Accessibility → Restore default worlds. */
export function clearDeletedDefaultWorlds(): void {
  try {
    localStorage.removeItem(DELETED_DEFAULTS_KEY);
  } catch {
    // Nothing to do — a storage that won't delete will also have refused to write the tombstone.
  }
}
