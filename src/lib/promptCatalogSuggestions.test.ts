import { describe, it, expect } from 'vitest';
import { collectPromptSuggestions, mergeModelSuggestions } from './promptCatalogSuggestions';

const prompt = (tags: string[], models: string[]) => ({ id: crypto.randomUUID(), kind: 'prompt', tags, models });

describe('collectPromptSuggestions', () => {
  it('ranks tags and models by how many listings use them', () => {
    const { tags, modelCounts } = collectPromptSuggestions([
      prompt(['rare'], ['Solo']),
      prompt(['common', 'mid'], ['Cydonia', 'Mid']),
      prompt(['common', 'mid'], ['Cydonia', 'Mid']),
      prompt(['common'], ['Cydonia']),
    ]);
    expect(tags).toEqual(['common', 'mid', 'rare']);
    expect(modelCounts.map((m) => m.name)).toEqual(['Cydonia', 'Mid', 'Solo']);
  });

  it('merges model spellings without regard to case and keeps the more common casing', () => {
    const { modelCounts } = collectPromptSuggestions([
      prompt([], ['cydonia']),
      prompt([], ['Cydonia']),
      prompt([], ['Cydonia']),
    ]);
    expect(modelCounts.map((m) => m.name)).toEqual(['Cydonia']);
  });

  it('counts a value once per listing', () => {
    const { tags, modelCounts } = collectPromptSuggestions([
      prompt(['a', 'A', ' a '], ['M', 'm']),
      prompt(['b'], ['N']),
      prompt(['b'], ['N']),
    ]);
    expect(tags).toEqual(['b', 'a']);
    expect(modelCounts.map((m) => m.name)).toEqual(['N', 'M']);
  });

  it('ignores listings of other kinds and malformed fields', () => {
    const { tags, modelCounts } = collectPromptSuggestions([
      { id: '1', kind: 'world', tags: ['fantasy'], models: ['WorldModel'] },
      { id: '2', tags: ['untyped'] },
      { id: '3', kind: 'prompt', tags: 'not-a-list', models: [7, '', 'Kept'] },
    ]);
    expect(tags).toEqual([]);
    expect(modelCounts.map((m) => m.name)).toEqual(['Kept']);
  });
});

describe('mergeModelSuggestions', () => {
  it('folds endpoint names into the catalog ranking and keeps the more common casing', () => {
    expect(mergeModelSuggestions(
      [{ name: 'Cydonia', count: 3 }, { name: 'Mid', count: 1 }],
      ['cydonia', 'Local-Only', 'mid'],
    )).toEqual(['Cydonia', 'Mid', 'Local-Only']);
  });

  it('lists endpoint names alone when no catalog is loaded', () => {
    expect(mergeModelSuggestions([], ['A', 'b'])).toEqual(['A', 'b']);
  });
});
