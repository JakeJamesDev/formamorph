import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HELP_SETTINGS } from './helpSettings';

describe('the default help settings', () => {
  it('equal the values the help session had as constants when the bar run measured it', () => {
    expect(DEFAULT_HELP_SETTINGS).toEqual({
      sources: { keyword: true, aiPicks: true, semantic: false },
      lookup: false,
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
