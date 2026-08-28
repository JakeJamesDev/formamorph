import { describe, it, expect } from 'vitest';
import { buildNarrationPrompt, type NarrationPromptInput } from './narrationPrompt';
import { defaultSystemPrompt } from '@/components/game/GamePrompts';
import { runsTile } from '@/lib/requestAnatomy';
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
      'Sedge Landing — a jetty of grey boards.',
    );
    // Same input, same bytes — nothing in the assembly reads a clock, a random, or module state.
    expect(buildNarrationPrompt(input).prompt).toBe(buildNarrationPrompt(input).prompt);
  });

  it('injects no notes at all when the prompt carries no notes chip', () => {
    const { prompt } = buildNarrationPrompt(base({ ctx: { ...CTX, '<NOTES>': 'Low tide at dusk.' } }));
    expect(prompt).not.toContain('Player Notes');
    expect(prompt).not.toContain('Low tide at dusk.');
  });

  it('renders the notes where the author put their chip', () => {
    const { prompt } = buildNarrationPrompt(base({
      template: '## Notes\n<NOTES>\n\n## Current Location\n<LOCATION>',
    }));
    expect(prompt).toContain('## Notes\nRemember the ferryman.');
    expect(prompt.indexOf('Remember the ferryman.')).toBeLessThan(prompt.indexOf('## Current Location'));
  });

  it('scans and renders a notes chip that carries a prefix, like any other placement', () => {
    // `<NOTES>` is affixable, so this spelling is one the chip editor produces. It resolves into the prompt
    // like a bare placement, so the lore scan has to see it too — a substring test for `<NOTES>` misses it
    // and would silently withhold the notes from activation.
    const { prompt, dictionaryDebug } = buildNarrationPrompt(base({
      template: '## Notes\n<NOTES|pre="Remember: ">\n\n## Current Location\n<LOCATION>',
      // Nothing but the notes carries the keyword, so the entry fires only if the notes were scanned.
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['ferryman'], value: 'He poles the flat boat.' })],
    }));
    expect(prompt).toContain('Remember: Remember the ferryman.');
    expect(dictionaryDebug.report.find((e) => e.entryId === 'a')?.activated).toBe(true);
    expect(dictionaryDebug.sources.map((s) => s.region)).toContain('notes');
  });

  it('reads an affixed dictionary placement as the chip it is', () => {
    // Same trap on the lore chips: an affixed after-chip must not be read as "no dictionary chip", which
    // would route every entry to a block the template does not have.
    const { prompt } = buildNarrationPrompt(base({
      template: '## Lore\n<DICTIONARY|pre="Lore: ">\n\n## Current Location\n<LOCATION>',
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['jetty'], value: 'He poles the flat boat.' })],
    }));
    expect(prompt).toContain('Lore: Ferryman: He poles the flat boat.');
  });

  it('renders the language directive wherever the author placed the chip', () => {
    const at = (template: string) =>
      buildNarrationPrompt(base({ template, language: 'French' })).prompt;
    expect(at('<LANGUAGE>\n\n## Current Location\n<LOCATION>'))
      .toBe('Write all narration in French.\n\n## Current Location\nSedge Landing — a jetty of grey boards.');
    expect(at('## Current Location\n<LOCATION>\n\n<LANGUAGE>\n\n## Notes\n<NOTES>'))
      .toBe('## Current Location\nSedge Landing — a jetty of grey boards.\n\nWrite all narration in French.\n\n## Notes\nRemember the ferryman.');
    expect(at('## Current Location\n<LOCATION>\n\n<LANGUAGE>'))
      .toBe('## Current Location\nSedge Landing — a jetty of grey boards.\n\nWrite all narration in French.');
  });

  it('injects no directive at all when the prompt carries no language chip, whatever the language', () => {
    for (const language of ['French', 'pirate speak', 'Japanese']) {
      expect(buildNarrationPrompt(base({ language })).prompt).not.toContain('Write all narration in');
    }
  });

  it('reads a padded value as the bare language name, and takes a style as an instruction', () => {
    const at = (language: string) =>
      buildNarrationPrompt(base({ template: '<LOCATION>\n\n<LANGUAGE>', language })).prompt;
    expect(at(' French ')).toContain('Write all narration in French.');
    // The field takes any string, so the sentence has to read as an instruction for a style too.
    expect(at('pirate speak')).toContain('Write all narration in pirate speak.');
  });

  it('resolves the chip to nothing for English, leaving no dangling blank lines', () => {
    for (const language of ['', '   ', 'english', 'ENGLISH', ' English ']) {
      const { prompt } = buildNarrationPrompt(base({ template: '<LOCATION>\n\n<LANGUAGE>', language }));
      expect(prompt).toBe('Sedge Landing — a jetty of grey boards.');
    }
  });

  it('renders the default template exactly as it shipped, in both language arms', () => {
    const render = (language: string) =>
      buildNarrationPrompt(base({ template: defaultSystemPrompt, language })).prompt;
    const english = render('English');
    // The chip takes its own blank lines with it: the prompt still ends on the template's last sentence.
    expect(english.endsWith('answers in their own quoted voice with something of their own.')).toBe(true);
    expect(english).not.toContain('Write all narration in');
    // And the non-English arm is that same prompt plus the directive as its final line, one blank line
    // after the body — the exact bytes the code-side append used to produce.
    expect(render('French')).toBe(`${english}\n\nWrite all narration in French.`);
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

  it('routes after-position entries into the before block when the prompt has no after chip', () => {
    // The mirror of the case above: an entry's position is world data, so the chip the author kept takes
    // both positions rather than half the lore going missing.
    const { prompt } = buildNarrationPrompt(base({
      template: '## Background\n<DICTIONARY|before>\n\n## Current Location\n<LOCATION>',
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['jetty'], value: 'He poles the flat boat.' })],
    }));
    expect(prompt).toContain('## Background\nFerryman: He poles the flat boat.');
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

  it('injects no lore at all when the prompt has no dictionary chip', () => {
    const { prompt, dictionaryDebug } = buildNarrationPrompt(base({
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['jetty'], value: 'He poles the flat boat.' })],
    }));
    expect(prompt).not.toContain('He poles the flat boat.');
    expect(prompt).not.toMatch(/Lore/);
    // The entry still activated — it is the injection that the missing chip removes, not the scan.
    expect(dictionaryDebug.report.find((e) => e.entryId === 'a')?.activated).toBe(true);
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

describe('buildNarrationPrompt anatomy runs', () => {
  it('tiles the prompt it rendered, with no gaps left by the trailing trim', () => {
    const { prompt, runs } = buildNarrationPrompt(base({
      template: '## Game World\n<WORLD DESCRIPTION>\n\n## Notes\n<NOTES>\n\n<LANGUAGE>',
    }));
    expect(runsTile(prompt, runs)).toBe(true);
  });

  it('points each run at the text it claims: template prose authored, chip values named by their chip', () => {
    const { prompt, runs } = buildNarrationPrompt(base({
      template: '## Game World\n<WORLD DESCRIPTION>\n\n## Current Location\n<LOCATION>',
    }));
    const at = (i: number) => prompt.slice(runs[i].start, runs[i].end);
    expect(at(0)).toBe('## Game World\n');
    expect(runs[0].source).toBe('system-template');
    expect(runs[0].chip).toBeUndefined();
    expect(at(1)).toBe(CTX['<WORLD DESCRIPTION>']);
    expect(runs[1].chip).toBe('<WORLD DESCRIPTION>');
    expect(at(2)).toBe('\n\n## Current Location\n');
    expect(at(3)).toBe(CTX['<LOCATION>']);
    expect(runs[3].chip).toBe('<LOCATION>');
  });

  it('marks the injected lore block as the dictionary chip, not as the author words', () => {
    const { prompt, runs } = buildNarrationPrompt(base({
      template: '## Lore\n<DICTIONARY>',
      dictionary: [entry({ id: 'a', name: 'Ferryman', key: ['ferryman'], value: 'He poles the flat boat.' })],
      action: 'ask the ferryman',
    }));
    const lore = runs.find((r) => r.chip === '<DICTIONARY>');
    expect(lore).toBeDefined();
    expect(prompt.slice(lore!.start, lore!.end)).toBe('Ferryman: He poles the flat boat.');
  });

  it('identifies the length guidance by its own chip, never as world data from the world', () => {
    // Guards against a catch-all label over every chip, which presents the reply-length instruction to
    // the player as part of their world.
    const { prompt, runs } = buildNarrationPrompt(base({
      template: '## Game World\n<WORLD DESCRIPTION>\n\n<LENGTH GUIDANCE>',
      paragraphLimit: 'auto',
    }));
    const guidance = runs.find((r) => r.chip === '<LENGTH GUIDANCE>');
    expect(guidance).toBeDefined();
    expect(prompt.slice(guidance!.start, guidance!.end)).toContain('paragraph');
    // The world's own chip is a run of its own, under its own name — the two are never one block.
    expect(runs.find((r) => r.chip === '<WORLD DESCRIPTION>')).toBeDefined();
  });

  it('runs tile the shipped default prompt too, chips and all', () => {
    const { prompt, runs } = buildNarrationPrompt(base({ template: defaultSystemPrompt }));
    expect(runsTile(prompt, runs)).toBe(true);
    expect(runs.some((r) => r.source === 'system-template')).toBe(true);
  });
});
