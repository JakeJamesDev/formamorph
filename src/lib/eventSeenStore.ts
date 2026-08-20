/**
 * What this device has already answered about a timed event: which phases were acknowledged in the
 * modal, and which banners were collapsed to a chip. Per-device rather than per-account so a signed-out
 * player isn't shown the same poster every launch (the help/tutorial seen-state precedent).
 *
 * Both are keyed by event id *and* phase, so an event that ends re-opens its banner and shows its
 * ending once, however thoroughly its opening was dismissed.
 *
 * Local-only UI state — never part of a world or save. Writes are try/catch'd because private-mode
 * browsers throw on `setItem`; a failed write just means the modal returns next session.
 */
import type { ServerEventPhase } from '@/types';

const ACK_KEY = 'FORMAMORPH_eventAcknowledged';
const DISMISS_KEY = 'FORMAMORPH_eventBannerDismissed';

function read(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function add(key: string, entry: string): void {
  const seen = read(key);
  if (seen.has(entry)) return;
  seen.add(entry);
  try {
    localStorage.setItem(key, JSON.stringify([...seen]));
  } catch {
    /* private mode — this device just answers again next session */
  }
}

function entryKey(eventId: string, phase: ServerEventPhase): string {
  return `${eventId}:${phase}`;
}

/** Whether this device has acknowledged this phase's modal. */
export function isEventAcknowledged(eventId: string, phase: ServerEventPhase): boolean {
  return read(ACK_KEY).has(entryKey(eventId, phase));
}

/** Record that this phase's modal was acknowledged. No-op when it already was. */
export function markEventAcknowledged(eventId: string, phase: ServerEventPhase): void {
  add(ACK_KEY, entryKey(eventId, phase));
}

/** Whether this device has collapsed this phase's banner to a chip. */
export function isEventBannerDismissed(eventId: string, phase: ServerEventPhase): boolean {
  return read(DISMISS_KEY).has(entryKey(eventId, phase));
}

/** Record that this phase's banner was collapsed. No-op when it already was. */
export function markEventBannerDismissed(eventId: string, phase: ServerEventPhase): void {
  add(DISMISS_KEY, entryKey(eventId, phase));
}
