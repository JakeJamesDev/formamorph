import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HELP_SETTINGS, HELP_HISTORY_MAX, SAME_AS_ANSWER, helpSettingsCodec, helpSettingsOf } from './helpSettings';
import { DEFAULT_HELP_REVEAL } from './helpReveal';
import { duplicateHelpPreset, EMPTY_HELP_PRESET_STORE } from './helpPresets';

describe('the default help settings', () => {
  it('equal the values the help session had as constants when the bar run measured it', () => {
    expect(DEFAULT_HELP_SETTINGS).toEqual({
      sources: { keyword: true, aiPicks: true, semantic: false },
      answerEndpoint: null,
      pickEndpoint: SAME_AS_ANSWER,
      lookup: false,
      openScreen: true,
      historyLength: 4,
      reasoning: { enabled: false, level: 'global' },
      reasoningBudget: 75,
      sourcesOpen: true,
      thinkingOpen: false,
      reveal: DEFAULT_HELP_REVEAL,
      presets: EMPTY_HELP_PRESET_STORE,
    });
  });
});

describe('the help session', () => {
  const source = readFileSync(resolve(__dirname, 'helpSession.ts'), 'utf8');

  it('takes the settings module as a type alone, so every value it reads comes from the question', () => {
    const imports = [...source.matchAll(/^import (type )?\{[^}]*\} from '\.\/helpSettings';$/gm)];
    expect(imports.map((match) => match[1])).toEqual(['type ']);
    expect(source).not.toContain('DEFAULT_HELP_SETTINGS');
  });

  it('declares no source, lookup, history or cap constant of its own', () => {
    expect(source).not.toMatch(/HELP_(LOOKUP_MODE|KEYWORD_SOURCE|AI_PICKS_SOURCE|SEMANTIC_SOURCE|HISTORY_EXCHANGES|MAX_TOKENS)\b/);
  });
});

describe('the stored help settings', () => {
  const stored = (value: unknown) => helpSettingsCodec.parse(JSON.stringify(value));

  it('read back what was written', () => {
    const changed = helpSettingsOf({ sources: { keyword: false, aiPicks: false }, openScreen: false, historyLength: 0 });
    expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(changed))).toEqual(changed);
  });

  it('take the default for each field that is missing or bad, and keep the good ones', () => {
    expect(stored({ sources: { keyword: 'yes', aiPicks: false }, openScreen: 0, historyLength: 2.5 }))
      .toEqual(helpSettingsOf({ sources: { aiPicks: false } }));
    expect(stored({ historyLength: HELP_HISTORY_MAX + 1 }).historyLength).toBe(DEFAULT_HELP_SETTINGS.historyLength);
    expect(stored({ historyLength: HELP_HISTORY_MAX }).historyLength).toBe(HELP_HISTORY_MAX);
    expect(stored({ sourcesOpen: 'no' }).sourcesOpen).toBe(true);
    expect(stored({ sourcesOpen: false }).sourcesOpen).toBe(false);
    expect(stored({ sources: null })).toEqual(DEFAULT_HELP_SETTINGS);
    expect(stored({})).toEqual(DEFAULT_HELP_SETTINGS);
  });

  it('keep a preset id or Follow Active for each route, and take the default for anything else', () => {
    expect(stored({ answerEndpoint: 'p1', pickEndpoint: null })).toMatchObject({ answerEndpoint: 'p1', pickEndpoint: null });
    expect(stored({ answerEndpoint: 4, pickEndpoint: '' })).toMatchObject({ answerEndpoint: null, pickEndpoint: SAME_AS_ANSWER });
    expect(stored({ answerEndpoint: SAME_AS_ANSWER }).answerEndpoint).toBeNull();
  });

  it('refuse text that is not a settings object, so the defaults stand', () => {
    for (const raw of ['not json', '[]', 'null', '4']) expect(() => helpSettingsCodec.parse(raw)).toThrow();
  });
});

describe('the help presets', () => {
  it('survive the codec, and a bad value reads as no custom preset', () => {
    const presets = duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, 'default', 'mine', 'Mine');
    const settings = helpSettingsOf({ presets, historyLength: 2 });
    expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(settings))).toEqual(settings);
    expect(helpSettingsCodec.parse(JSON.stringify({ presets: 'mine', historyLength: 2 }))).toEqual(helpSettingsOf({ historyLength: 2 }));
  });
});

describe('the reveal values', () => {
  it('change only the values a change names', () => {
    const blurred = helpSettingsOf({ reveal: { blur: true } });
    expect(helpSettingsOf({ reveal: { easing: 'linear' } }, blurred).reveal).toEqual({ ...DEFAULT_HELP_REVEAL, blur: true, easing: 'linear' });
  });

  it('survive the codec, and a value that is not an object takes the defaults', () => {
    const settings = helpSettingsOf({ reveal: { fade: false, minStagger: 90 } });
    expect(helpSettingsCodec.parse(helpSettingsCodec.serialize(settings)).reveal).toEqual(settings.reveal);
    expect(helpSettingsCodec.parse(JSON.stringify({ reveal: 'fade' })).reveal).toEqual(DEFAULT_HELP_REVEAL);
    expect(helpSettingsCodec.parse(JSON.stringify({ reveal: { blur: 3 } })).reveal).toEqual(DEFAULT_HELP_REVEAL);
  });
});
