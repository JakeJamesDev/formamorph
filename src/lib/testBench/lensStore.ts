/**
 * Where the Bench's lens selections live between tab switches: one sessionStorage record keyed by world id.
 *
 * Session-scoped on purpose. The lens is a test setup, not authoring — it is worth surviving a tab switch or
 * a trip out to the world list, and not worth greeting the author with next week. Bench-local like every
 * other piece of Bench state; none of it is a byte of the world.
 */
import { createKeyedRecordStore } from '@/lib/keyedStorage';
import { EMPTY_LENS, type LensState } from './lens';
import type { WorldOptionValues } from '@/types';

const store = createKeyedRecordStore('session', 'FORMAMORPH_benchLens');

const asId = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** The stored lens for one world, sanitized — a hand-edited or half-written record reads as no selection. */
export function readLensState(worldId: string): LensState | null {
  const stored = store.read(worldId);
  if (!stored || typeof stored !== 'object') return null;
  const { personaId, locationId, locationChosen, optionValues } = stored as Partial<LensState>;
  const values = asOptionValues(optionValues);
  return {
    ...EMPTY_LENS, personaId: asId(personaId), locationId: asId(locationId), ...(locationChosen === true ? { locationChosen } : {}),
    ...(values ? { optionValues: values } : {}),
  };
}

/** Stored Option values; each that no longer fits its Option reads the default at use. */
function asOptionValues(value: unknown): WorldOptionValues | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kept = Object.entries(value).filter(([, v]) => typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number');
  return kept.length ? Object.fromEntries(kept) as WorldOptionValues : null;
}

export function writeLensState(worldId: string, state: LensState): void {
  store.write(worldId, state);
}
