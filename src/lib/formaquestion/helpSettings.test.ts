import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HELP_SETTINGS, HELP_HISTORY_MAX, helpSettingsCodec, helpSettingsOf } from './helpSettings';

describe('the default help settings', () => {
  it('equal the values the help session had as constants when the bar run measured it', () => {
    expect(DEFAULT_HELP_SETTINGS).toEqual({
      sources: { keyword: true, aiPicks: true, semantic: false },
      lookup: false,
      openScreen: true,
      historyLength: 4,
      answerMaxTokens: 800,
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
    expect(stored({ sources: { keyword: 'yes', aiPicks: false }, openScreen: 0, historyLength: 2.5, answerMaxTokens: -1 }))
      .toEqual(helpSettingsOf({ sources: { aiPicks: false } }));
    expect(stored({ historyLength: HELP_HISTORY_MAX + 1 }).historyLength).toBe(DEFAULT_HELP_SETTINGS.historyLength);
    expect(stored({ historyLength: HELP_HISTORY_MAX }).historyLength).toBe(HELP_HISTORY_MAX);
    expect(stored({ sources: null })).toEqual(DEFAULT_HELP_SETTINGS);
    expect(stored({})).toEqual(DEFAULT_HELP_SETTINGS);
  });

  it('refuse text that is not a settings object, so the defaults stand', () => {
    for (const raw of ['not json', '[]', 'null', '4']) expect(() => helpSettingsCodec.parse(raw)).toThrow();
  });
});
