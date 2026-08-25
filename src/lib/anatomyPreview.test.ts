import { describe, it, expect } from 'vitest';
import { buildAnatomyPreview, type AnatomyConditions, type AnatomyPreviewPrompts } from './anatomyPreview';
import { runsTile, type AnatomyBlock } from './requestAnatomy';
import { composePreviewValues } from './previewValuePool';
import {
  defaultSystemPrompt, defaultNarrationUserPrompt, defaultRecapUserPrompt,
  defaultNowLinePrompt, defaultRehydrateUserPrompt, defaultOocDirectivePrompt,
} from '@/components/game/GamePrompts';

const VALUES = composePreviewValues({
  paragraphLimit: 'none', maxTokens: 800, markdownOutput: true, sectionStyle: 'markdown',
  limitActiveCharacters: false, activeCharacterLimit: 3, language: 'English',
});

const PROMPTS: AnatomyPreviewPrompts = {
  system: defaultSystemPrompt,
  narrationUser: defaultNarrationUserPrompt,
  recap: defaultRecapUserPrompt,
  now: defaultNowLinePrompt,
  recall: defaultRehydrateUserPrompt,
  direction: defaultOocDirectivePrompt,
};

const ALL_ON: AnatomyConditions = { recap: true, recall: true, brackets: true };
const preview = (over: Partial<AnatomyConditions> = {}, prompts = PROMPTS) =>
  buildAnatomyPreview(prompts, VALUES, { ...ALL_ON, ...over });

/** Every label present anywhere in a preview, authored and context alike. */
const labels = (blocks: AnatomyBlock[]) =>
  blocks.flatMap((b) => b.runs.map((r) => r.source ?? r.contextLabel));

/** The text one source's run actually selects, across every block. */
const textOf = (blocks: AnatomyBlock[], source: string) =>
  blocks.flatMap((b) => b.runs.filter((r) => r.source === source).map((r) => b.content.slice(r.start, r.end)));

describe('buildAnatomyPreview', () => {
  it('opens with the system message and continues as an alternating conversation', () => {
    const blocks = preview();
    expect(blocks[0].role).toBe('system');
    expect(blocks.slice(1).map((b) => b.role)).toEqual(
      blocks.slice(1).map((_, i) => (i % 2 === 0 ? 'user' : 'assistant')),
    );
    expect(blocks[blocks.length - 1].role).toBe('user');
  });

  it('tiles every block exactly, under every combination of conditions', () => {
    for (const recap of [true, false]) {
      for (const recall of [true, false]) {
        for (const brackets of [true, false]) {
          const blocks = preview({ recap, recall, brackets });
          blocks.forEach((b) => expect(runsTile(b.content, b.runs)).toBe(true));
        }
      }
    }
  });

  it('shows all six editor surfaces with every condition on', () => {
    expect(new Set(labels(preview()))).toEqual(
      new Set([
        'system-template', 'user-template', 'recap', 'now', 'recall', 'direction',
        'world-data', 'condensed', 'recalled', 'past-action', 'past-narration', 'action',
      ]),
    );
  });

  it('shows the player their own text, not a paraphrase of it', () => {
    const blocks = preview();
    expect(textOf(blocks, 'recap')).toEqual([defaultRecapUserPrompt]);
    expect(textOf(blocks, 'recall')).toEqual([defaultRehydrateUserPrompt]);
    expect(textOf(blocks, 'direction')).toEqual([defaultOocDirectivePrompt]);
    // The now-line is a template, so what lands is its render against this world's values.
    expect(textOf(blocks, 'now')).toEqual([expect.stringContaining('Now you are at')]);
    expect(textOf(blocks, 'system-template').join('')).toContain('You are the narrator stage');
  });

  it('follows an edit to a message through into the request', () => {
    const edited = { ...PROMPTS, recap: 'WHAT HAPPENED BEFORE THIS?' };
    expect(textOf(preview({}, edited), 'recap')).toEqual(['WHAT HAPPENED BEFORE THIS?']);
  });

  it('drops the recap exchange, and the now-line with it, when nothing is condensed', () => {
    const off = labels(preview({ recap: false }));
    expect(off).not.toContain('recap');
    expect(off).not.toContain('now');
    expect(off).not.toContain('condensed');
    // Every turn rides full instead, so nothing is lost — it is just not condensed.
    expect(off.filter((l) => l === 'past-narration')).toHaveLength(4);
  });

  it('drops both recall runs when Scene Recall did not fire', () => {
    const off = labels(preview({ recall: false }));
    expect(off).not.toContain('recall');
    expect(off).not.toContain('recalled');
    expect(labels(preview({ recall: true }))).toContain('recalled');
  });

  it('recalls a scene only from the condensed band, since that is where it is pulled from', () => {
    expect(labels(preview({ recap: false, recall: true }))).not.toContain('recalled');
  });

  it('marks the direction rider only on a bracketed action', () => {
    const on = preview({ brackets: true });
    expect(labels(on)).toContain('direction');
    const action = on[on.length - 1].content;
    expect(action).toContain('[keep the tide going out through this scene]');
    expect(labels(preview({ brackets: false }))).not.toContain('direction');
    expect(preview({ brackets: false })[0]).toBeDefined();
  });

  it('separates the template the player typed from the action it wraps', () => {
    const blocks = preview({ brackets: false });
    const last = blocks[blocks.length - 1];
    const runs = last.runs.map((r) => [r.source ?? r.contextLabel, last.content.slice(r.start, r.end)]);
    expect(runs).toContainEqual(['action', 'I take the map and start down toward the causeway.']);
    expect(runs.some(([label]) => label === 'user-template')).toBe(true);
  });

  it('splits the system prompt into the author words and the world data its chips inject', () => {
    const system = preview()[0];
    const chipRuns = system.runs.filter((r) => r.contextLabel === 'world-data');
    expect(chipRuns.length).toBeGreaterThan(1);
    // A chip's run holds the injected value, never the token that asked for it.
    expect(chipRuns.map((r) => system.content.slice(r.start, r.end)).join('\n')).not.toContain('<WORLD DESCRIPTION>');
    expect(system.content).toContain('Sample Town');
  });

  it('is deterministic — the same inputs draw the same request every time', () => {
    expect(preview()).toEqual(preview());
  });
});
