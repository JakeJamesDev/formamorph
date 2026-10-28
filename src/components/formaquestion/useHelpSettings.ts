import { useSyncExternalStore } from 'react';
import { DEFAULT_HELP_SETTINGS, helpSettingsCodec, helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';

const STORAGE_KEY = 'FORMAMORPH_helpSettings';

/** The settings last read, with the stored text they came from. */
let held: { raw: string | null; value: HelpSettings } = { raw: null, value: DEFAULT_HELP_SETTINGS };
const listeners = new Set<() => void>();

/** True while a change that storage refused is the only copy of the settings. */
let unstored = false;

/** The stored text, or undefined when storage is blocked. */
function readRaw(): string | null | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
}

/** The settings on this device; the defaults when none are stored or the value is bad. Parsed again only when the stored text changes. */
function snapshot(): HelpSettings {
  const raw = readRaw();
  // Blocked storage reads the defaults until a change is made, which then holds for the session.
  if (raw === undefined) return unstored ? held.value : DEFAULT_HELP_SETTINGS;
  if (raw === held.raw) return held.value;
  unstored = false;
  let value = DEFAULT_HELP_SETTINGS;
  try {
    if (raw !== null) value = helpSettingsCodec.parse(raw);
  } catch {
    // A bad value reads as the defaults.
  }
  held = { raw, value };
  return value;
}

/** Applies a change for every user of the hook. Only a change writes to storage. */
function change(next: HelpSettingsChange) {
  const before = snapshot();
  const value = helpSettingsOf(next, before);
  try {
    const raw = helpSettingsCodec.serialize(value);
    localStorage.setItem(STORAGE_KEY, raw);
    held = { raw, value };
    unstored = false;
  } catch {
    // Blocked storage: the change holds while a user of the hook is mounted.
    held = { raw: held.raw, value };
    unstored = true;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
    // With no user left, a refused change has nowhere to live.
    if (listeners.size === 0) {
      held = { raw: null, value: DEFAULT_HELP_SETTINGS };
      unstored = false;
    }
  };
}

/** The settings as they are now, for a handler that must not read a stale render. */
export const currentHelpSettings = snapshot;

/** A change from outside React, as the hook's own change makes it. */
export const changeHelpSettings = change;

/** The Formaquestion settings on this device, shared by every user of the hook, and a change to them. */
export function useHelpSettings() {
  return [useSyncExternalStore(subscribe, snapshot), change] as const;
}
