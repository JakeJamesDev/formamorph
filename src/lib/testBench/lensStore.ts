/**
 * Where the Bench's lens selections live between tab switches: one sessionStorage record keyed by world id.
 *
 * Session-scoped on purpose. The lens is a test setup, not authoring — it is worth surviving a tab switch or
 * a trip out to the world list, and not worth greeting the author with next week. Bench-local like every
 * other piece of Bench state; none of it is a byte of the world.
 */
import { EMPTY_LENS, type LensState } from './lens';

const STORAGE_KEY = 'FORMAMORPH_benchLens';

const readAll = (): Record<string, LensState> => {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, LensState>) : {};
  } catch {
    return {};
  }
};

const asId = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** The stored lens for one world, sanitized — a hand-edited or half-written record reads as no selection. */
export function readLensState(worldId: string): LensState | null {
  const stored: unknown = readAll()[worldId];
  if (!stored || typeof stored !== 'object') return null;
  const { pcTraitId, locationId } = stored as Partial<LensState>;
  return { ...EMPTY_LENS, pcTraitId: asId(pcTraitId), locationId: asId(locationId) };
}

export function writeLensState(worldId: string, state: LensState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [worldId]: state }));
  } catch {
    // A full or blocked sessionStorage costs the lens re-seeding next time the Bench opens, nothing else.
  }
}
