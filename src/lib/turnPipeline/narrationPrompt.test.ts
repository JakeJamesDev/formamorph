import { describe, it, expect } from 'vitest';
import { buildNarrationPrompt, type NarrationPromptInput } from './narrationPrompt';
import type { DictionaryEntry } from '@/types/world';
import type { ChatMessage } from '@/types';

const entry = (over: Partial<DictionaryEntry> & { id: string }): DictionaryEntry => ({
  name: over.id, key: [], value: '', ...over,
});

const CTX: Record<string, string> = {
  '<WORLD DESCRIPTION>': 'A salt marsh at the edge of the tide.',
  '<LOCATION>': 'Sedge Landing — a jetty of grey boards.',
  '<NOTES>': 'Remember the ferryman.',
};

const HISTORY: ChatMessage[] = [
  { role: 'user', content: 'ask about the ferry' },
  { role: 'assistant', content: '{"narration":"The boards creak."}' },
];

const base = (over: Partial<NarrationPromptInput> = {}): NarrationPromptInput => ({
  template: '## Game World\n<WORLD DESCRIPTION>\n\n## Current Location\n<LOCATION>\n',
  ctx: CTX,
  action: 'walk out onto the jetty',
  playerNotes: 'Remember the ferryman.',
  history: HISTORY,
  dictionary: [],
  actionVec: null,
  semanticLore: false,
  embedVectors: new Map(),
  language: 'English',
  paragraphLimit: 'none',
  maxTokens: 512,
  markdownOutput: true,
  sectionStyle: 'markdown',
  resolvePH: (t) => t,
  ...over,
});

describe('buildNarrationPrompt', () => {
  it('renders a fixed input to a byte-identical prompt', () => {
    const input = base({
      template:
        '## Game World\n<WORLD DESCRIPTION>\n\n## Lore\n<DICTIONARY>\n\n## Notes\n<NOTES>\n\n## Current Location\n<LOCATION>\n',
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['ferryman'], value: 'He poles the flat boat.' })],
    });
    // The whole prompt, verbatim: any drift in chip order, block wording, or spacing fails here.
    expect(buildNarrationPrompt(input).prompt).toBe(
      '## Game World\n' +
      'A salt marsh at the edge of the tide.\n' +
      '\n' +
      '## Lore\n' +
      'Ferryman: He poles the flat boat.\n' +
      '\n' +
      '## Notes\n' +
      'Remember the ferryman.\n' +
      '\n' +
      '## Current Location\n' +
      'Sedge Landing — a jetty of grey boards.\n',
    );
    // Same input, same bytes — nothing in the assembly reads a clock, a random, or module state.
    expect(buildNarrationPrompt(input).prompt).toBe(buildNarrationPrompt(input).prompt);
  });

  it('inserts the notes fallback before the location header when the prompt has no notes chip', () => {
    const { prompt } = buildNarrationPrompt(base({ playerNotes: 'Low tide at dusk.' }));
    expect(prompt).toContain('## Player Notes\nLow tide at dusk.');
    expect(prompt.indexOf('## Player Notes')).toBeLessThan(prompt.indexOf('## Current Location'));
  });

  it('leaves the notes fallback out when the prompt carries a notes chip', () => {
    const { prompt } = buildNarrationPrompt(base({
      template: '## Notes\n<NOTES>\n\n## Current Location\n<LOCATION>\n',
    }));
    expect(prompt).not.toContain('## Player Notes');
    expect(prompt).toContain('Remember the ferryman.');
  });

  it('appends an imperative language directive only when the language is not English', () => {
    expect(buildNarrationPrompt(base()).prompt).not.toContain('Write all narration in');
    expect(buildNarrationPrompt(base({ language: 'Français' })).prompt).toContain('Write all narration in Français.');
    // The field takes any string, so the sentence has to read as an instruction for a style too.
    expect(buildNarrationPrompt(base({ language: 'pirate speak' })).prompt)
      .toContain('Write all narration in pirate speak.');
  });

  it('keeps the language directive as the last line even when lore is appended after the prompt', () => {
    const { prompt } = buildNarrationPrompt(base({
      language: 'French',
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['jetty'], value: 'He poles the flat boat.' })],
    }));
    // The backward-compat lore append is active here; the directive still has the final word.
    expect(prompt).toContain('He poles the flat boat.');
    expect(prompt.trimEnd().split('\n').pop()).toBe('Write all narration in French.');
  });

  it('counts blank, whitespace and any casing of English as English', () => {
    for (const language of ['', '   ', 'english', 'ENGLISH', ' English ']) {
      expect(buildNarrationPrompt(base({ language })).prompt).not.toContain('Write all narration in');
    }
  });

  it('reads a padded value as the bare language name', () => {
    expect(buildNarrationPrompt(base({ language: ' French ' })).prompt)
      .toContain('Write all narration in French.');
  });

  it('routes before-position entries into the after block when the prompt has no before chip', () => {
    const dictionary = [
      entry({ id: 'b', name: 'Tide', key: ['jetty'], value: 'It runs out fast.', position: 'before' }),
    ];
    const { prompt } = buildNarrationPrompt(base({
      template: '## Lore\n<DICTIONARY>\n\n## Current Location\n<LOCATION>\n',
      dictionary,
    }));
    expect(prompt).toContain('Tide: It runs out fast.');
  });

  it('splits the two lorebook blocks when the prompt carries both chips', () => {
    const dictionary = [
      entry({ id: 'b', name: 'Tide', key: ['jetty'], value: 'It runs out fast.', position: 'before' }),
      entry({ id: 'a', name: 'Ferryman', key: ['jetty'], value: 'He poles the flat boat.' }),
    ];
    const { prompt } = buildNarrationPrompt(base({
      template: '## Background\n<DICTIONARY|before>\n\n## Foreground\n<DICTIONARY>\n\n## Current Location\n<LOCATION>\n',
      dictionary,
    }));
    expect(prompt.indexOf('Tide:')).toBeLessThan(prompt.indexOf('Ferryman:'));
    expect(prompt.indexOf('## Background')).toBeLessThan(prompt.indexOf('Tide:'));
    expect(prompt.indexOf('## Foreground')).toBeLessThan(prompt.indexOf('Ferryman:'));
  });

  it('appends activated lore with its own heading when the prompt has no dictionary chip at all', () => {
    const { prompt } = buildNarrationPrompt(base({
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['jetty'], value: 'He poles the flat boat.' })],
    }));
    expect(prompt).toMatch(/#+ .*Lore[\s\S]*He poles the flat boat\./);
  });

  it('never injects a disabled entry, however well its keywords match', () => {
    const { prompt } = buildNarrationPrompt(base({
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['jetty'], value: 'SECRET', enabled: false })],
    }));
    expect(prompt).not.toContain('SECRET');
  });

  it('adds semantic activations only when semantic lore is on and the action embedded', () => {
    const dictionary = [entry({ id: 'a', name: 'Ferryman', key: ['nothing-matches'], value: 'He poles the flat boat.' })];
    const vec = new Float32Array([1, 0]);
    const embedVectors = new Map<string, Float32Array>([['dict:a:v1', new Float32Array([1, 0])]]);
    // Off, or with no action vector, the keyword scan is the only source — and it missed.
    expect(buildNarrationPrompt(base({ dictionary, actionVec: vec, semanticLore: false, embedVectors })).prompt)
      .not.toContain('He poles the flat boat.');
    expect(buildNarrationPrompt(base({ dictionary, actionVec: null, semanticLore: true, embedVectors })).prompt)
      .not.toContain('He poles the flat boat.');
  });

  it('reports only the scanned strings a hit actually landed in', () => {
    const { dictionaryDebug } = buildNarrationPrompt(base({
      template: '## Game World\n<WORLD DESCRIPTION>\n\n## Current Location\n<LOCATION>\n',
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['jetty'], value: 'He poles the flat boat.' })],
    }));
    const regions = dictionaryDebug.sources.map((s) => s.region);
    // "jetty" is in the location chip and the action, not the world description.
    expect(regions).toContain('<LOCATION>');
    expect(regions).toContain('action');
    expect(regions).not.toContain('<WORLD DESCRIPTION>');
    expect(dictionaryDebug.report.find((e) => e.entryId === 'a')?.activated).toBe(true);
  });
});
