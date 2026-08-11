// Storage is real (in-memory): the drift guard below mounts the actual settings provider.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { settingsUseAdvancedValues, HIDDEN_SETTING_DEFAULTS, type SettingsAdvancedInput } from './settingsAdvancedData';

/** A fresh install: every hidden setting sitting on the value it shipped with. */
const untouched: SettingsAdvancedInput = { ...HIDDEN_SETTING_DEFAULTS };

beforeEach(() => localStorage.clear());

describe('settingsUseAdvancedValues', () => {
  it('is false when nothing hidden has been touched', () => {
    expect(settingsUseAdvancedValues(untouched)).toBe(false);
  });

  it.each([
    ['a paragraph limit', { paragraphLimit: 'single' as const }],
    ['markdown off', { markdownOutput: false }],
    ['a native reasoning level', { reasoningEffort: 'high' as const }],
    ['the character limit lifted', { limitActiveCharacters: false }],
    ['a different character limit', { activeCharacterLimit: 3 }],
    ['memory summaries off', { memoryDigests: false }],
    ['semantic memory on', { semanticMemory: true }],
    ['a different memory cap', { semanticBandCap: 20 }],
    ['scene recall on', { semanticRehydration: true }],
    ['time in memory on', { timeContext: true }],
    ['the measured clock on', { aiClock: true }],
    ['semantic lore on', { semanticLore: true }],
    ['character descriptions on', { describeCharacters: true }],
    ['diaries on', { characterDiaries: true }],
    ['diary recall on', { semanticDiaries: true }],
    ['concurrent requests off', { concurrentTurnRequests: false }],
    ['reasoning hidden', { showReasoning: false }],
    ['silent requests shown', { showSilentRequests: true }],
    ['a raised output cap', { maxTokens: HIDDEN_SETTING_DEFAULTS.maxTokens * 2 }],
    ['a custom portrait size', { imagePortraitWidth: 1024 }],
    ['a custom landscape size', { imageLandscapeHeight: 1024 }],
    ['an edited ComfyUI workflow', { imageWorkflowCustom: true }],
    ['an InvokeAI board', { imageInvokeBoard: 'b1' }],
    ['an InvokeAI encoder', { imageInvokeEncoder: 'qwen3-4b' }],
    ['an InvokeAI VAE', { imageInvokeVae: 'flux-schnell-vae' }],
    ['a user-made prompt preset', { promptPresetCustom: true }],
  ])('is true for %s', (_label, patch) => {
    expect(settingsUseAdvancedValues({ ...untouched, ...patch })).toBe(true);
  });

  // Describing new characters is switched on for you when diaries go on, so that reading is the shipped
  // default there rather than something the player chose.
  it('is false for descriptions that came on with diaries, and true for descriptions alone', () => {
    expect(settingsUseAdvancedValues({ characterDiaries: true, describeCharacters: true })).toBe(true); // diaries alone raise it
    expect(settingsUseAdvancedValues({ describeCharacters: true, characterDiaries: false })).toBe(true);
    expect(settingsUseAdvancedValues({ describeCharacters: false, characterDiaries: false })).toBe(false);
    // Diaries on, descriptions left as they were seeded: nothing here is the player's doing.
    expect(settingsUseAdvancedValues({ describeCharacters: true })).toBe(true);
  });

  it('compares only the fields it is handed, so a row Advanced cannot draw raises nothing', () => {
    expect(settingsUseAdvancedValues({})).toBe(false);
    expect(settingsUseAdvancedValues({ markdownOutput: false })).toBe(true);
  });

  // Context Window is filled in on connect, so it says nothing about what the player chose.
  it('has no field for the auto-detected context window', () => {
    expect(Object.keys(HIDDEN_SETTING_DEFAULTS)).not.toContain('contextWindow');
  });
});

/** The settings the provider hands out on a fresh install. */
function freshSettings() {
  let seen: ReturnType<typeof useSettings> | null = null;
  const Probe = () => { seen = useSettings(); return null; };
  render(<SettingsProvider><Probe /></SettingsProvider>);
  return seen as unknown as Record<string, unknown>;
}

// Without this, changing a default in SettingsContext leaves the marker reporting the old one as "touched"
// — the dot would appear on a fresh install, and nothing else would notice.
describe('the hidden-field defaults match the live ones', () => {
  it.each(([
    'paragraphLimit', 'markdownOutput', 'reasoningEffort', 'limitActiveCharacters', 'activeCharacterLimit',
    'memoryDigests', 'semanticMemory', 'semanticBandCap', 'semanticRehydration', 'timeContext', 'aiClock',
    'semanticLore', 'characterDiaries', 'describeCharacters', 'semanticDiaries', 'concurrentTurnRequests',
    'showReasoning', 'showSilentRequests', 'maxTokens', 'imagePortraitWidth', 'imagePortraitHeight',
    'imageLandscapeWidth', 'imageLandscapeHeight', 'imageInvokeBoard', 'imageInvokeEncoder', 'imageInvokeVae',
  ] as (keyof SettingsAdvancedInput)[]))('%s', (key) => {
    expect(freshSettings()[key]).toEqual(HIDDEN_SETTING_DEFAULTS[key]);
  });
});
