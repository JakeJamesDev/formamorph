import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_HELP_SETTINGS, helpSettingsCodec, helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';

const STORAGE_KEY = 'FORMAMORPH_helpSettings';

/** The stored settings; the defaults when none are stored, the value is bad, or storage is blocked. */
function readStored(): HelpSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? DEFAULT_HELP_SETTINGS : helpSettingsCodec.parse(raw);
  } catch {
    return DEFAULT_HELP_SETTINGS;
  }
}

/** The Formaquestion settings on this device, and a change to them. Only a change writes to storage. */
export function useHelpSettings() {
  const [settings, setSettings] = useState(readStored);
  const changed = useRef(false);
  useEffect(() => {
    if (!changed.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, helpSettingsCodec.serialize(settings));
    } catch {
      // Blocked storage: the change holds until the app closes.
    }
  }, [settings]);
  const change = useCallback((next: HelpSettingsChange) => {
    changed.current = true;
    setSettings((current) => helpSettingsOf(next, current));
  }, []);
  return [settings, change] as const;
}
