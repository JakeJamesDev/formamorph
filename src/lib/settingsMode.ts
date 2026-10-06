/**
 * Settings Simple/Advanced mode — a device-local chrome preference, never part of a world or save.
 *
 * Simple keeps everyday play reachable (appearance, scene, narration feel, the reading controls, the core
 * turn toggles, endpoint connection, autosave) and hides the tuning surfaces: the Prompts tab, the image
 * Tag Prompt sub-tab, and the rows gated at their call sites in `SettingsModal`. What Simple hides is
 * enumerated once more in `settingsAdvancedData`, which is what the mode select's dot reads. Hidden
 * settings keep applying — the mode is a visibility filter and nothing else.
 */
export type SettingsMode = 'simple' | 'advanced';

/** What each mode says about itself in the mode select's list. */
export const SETTINGS_MODE_DESCRIPTIONS: Record<SettingsMode, string> = {
  simple: 'Just the essentials',
  advanced: 'Every setting',
};

/** The dot's accessible name and tooltip while Simple hides a setting that is off its default. */
export const SETTINGS_HIDDEN_NOTICE = {
  label: 'Hidden settings are off their defaults',
  tip: 'Some hidden settings are off their defaults. Switch to Advanced to see them.',
};

const STORAGE_KEY = 'formamorph.settingsMode';

/** The stored preference. Anything but the literal `advanced` — missing, corrupt, denied — reads as Simple. */
export function readSettingsMode(): SettingsMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
}

export function writeSettingsMode(mode: SettingsMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private-mode storage denial: the mode still works for this session.
  }
}
