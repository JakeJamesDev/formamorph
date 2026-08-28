import { describe, it, expect } from 'vitest';
import {
  resolvePromptJump, resolveChipJump, resolveContextJump, CONTEXT_OWNER, PROMPT_TAB_FOR_REQUEST,
} from './promptJump';
import { CONTEXT_LABELS, SOURCE_LABELS, type AnatomySource, type ContextLabel } from './requestAnatomy';
import { allGroupedTabs } from './promptGroups';
import type { AIRequestType } from '@/types';

/**
 * Where a click on a highlighted run, or on a chip, goes. What matters here is that every authored run
 * across every pass resolves to a prompt the rail really lists and an editor that really exists, that a run
 * on a call with no editor behind it resolves to nothing at all, and that an assembled block leads to the
 * prompt that wrote it — or nowhere, where nobody did.
 */

const SOURCES = Object.keys(SOURCE_LABELS) as AnatomySource[];

describe('resolvePromptJump', () => {
  it('sends the two per-pass editors to that pass own prompt', () => {
    expect(resolvePromptJump('system-template', 'choices')).toEqual({ tab: 'choices', surface: 'system' });
    expect(resolvePromptJump('user-template', 'choices')).toEqual({ tab: 'choices', surface: 'user' });
    expect(resolvePromptJump('system-template', 'statUpdates')).toEqual({ tab: 'statupdates', surface: 'system' });
    expect(resolvePromptJump('system-template', 'sceneTags')).toEqual({ tab: 'scenetags', surface: 'system' });
    expect(resolvePromptJump('user-template', 'openingTime')).toEqual({ tab: 'timeopening', surface: 'user' });
  });

  it('sends each stacked narration line to its own field on the Messages view', () => {
    for (const field of ['recap', 'now', 'recall', 'direction'] as const) {
      expect(resolvePromptJump(field, 'narration')).toEqual({ tab: 'narration', surface: 'messages', field });
    }
  });

  it('keeps the stacked lines on Narration even when the capture is another pass', () => {
    // The recap exchange rides the narration history, so a run naming it is that editor wherever it turns up.
    expect(resolvePromptJump('recap', 'summary')).toEqual({ tab: 'narration', surface: 'messages', field: 'recap' });
  });

  it('resolves nothing for a call with no editor behind it', () => {
    for (const type of ['discoverEntity', 'milestoneSelect'] as AIRequestType[]) {
      for (const source of SOURCES) {
        const target = resolvePromptJump(source, type);
        // The stacked narration lines still resolve — they belong to the Narration prompt, not this call.
        expect(target === null || target.tab === 'narration').toBe(true);
      }
    }
    expect(resolvePromptJump('system-template', 'discoverEntity')).toBeNull();
    expect(resolvePromptJump('user-template', 'milestoneSelect')).toBeNull();
  });

  it('resolves every source on every mapped request to a prompt the rail lists', () => {
    const rail = new Set(allGroupedTabs());
    for (const type of Object.keys(PROMPT_TAB_FOR_REQUEST) as AIRequestType[]) {
      for (const source of SOURCES) {
        const target = resolvePromptJump(source, type)!;
        expect(target).not.toBeNull();
        expect(rail.has(target.tab)).toBe(true);
      }
    }
  });

  it('names a prompt the rail lists for every request kind it maps', () => {
    const rail = new Set(allGroupedTabs());
    for (const tab of Object.values(PROMPT_TAB_FOR_REQUEST)) expect(rail.has(tab)).toBe(true);
  });
});

describe('resolveChipJump', () => {
  it('lands on the editor holding the chip, and names the chip to reveal there', () => {
    expect(resolveChipJump('system-template', 'choices', '<WORLD DESCRIPTION>')).toEqual({
      tab: 'choices', surface: 'system', chip: '<WORLD DESCRIPTION>',
    });
    expect(resolveChipJump('user-template', 'statUpdates', '<NARRATION>')).toEqual({
      tab: 'statupdates', surface: 'user', chip: '<NARRATION>',
    });
  });

  it('resolves nothing where the run own editor resolves nothing', () => {
    expect(resolveChipJump('system-template', 'discoverEntity', '<NOTES>')).toBeNull();
  });
});

describe('resolveContextJump', () => {
  it('follows an assembled block back to the prompt that wrote it', () => {
    expect(resolveContextJump('turn-plan')).toEqual({ tab: 'thinking' });
    expect(resolveContextJump('character-brief')).toEqual({ tab: 'character' });
    expect(resolveContextJump('intents')).toEqual({ tab: 'character' });
    expect(resolveContextJump('diary-brief')).toEqual({ tab: 'diary' });
    expect(resolveContextJump('condensed')).toEqual({ tab: 'summary' });
  });

  it('leaves the blocks nobody authored inert', () => {
    // The player's own words, the turns already played, their notes, and a mode's own directive: there is
    // no prompt to open, so a chip for one of these must not offer a click.
    for (const label of ['action', 'past-action', 'past-narration', 'recalled', 'notes', 'mode-directive'] as const) {
      expect(resolveContextJump(label)).toBeNull();
    }
  });

  it('carries no owner for a label that only ever rides a template chip', () => {
    // Every `narration` and `scene-cast` run comes from a chip (`<NARRATION>`, `<IN FRAME>`), and a chip's
    // click goes to its own placement — an owner row here could never fire, so there must not be one.
    for (const label of ['narration', 'scene-cast'] as const) {
      expect(resolveContextJump(label)).toBeNull();
    }
  });

  it('leads only to prompts the rail lists, and names a label that exists', () => {
    const rail = new Set(allGroupedTabs());
    for (const [label, tab] of Object.entries(CONTEXT_OWNER)) {
      expect(rail.has(tab)).toBe(true);
      expect(CONTEXT_LABELS[label as ContextLabel]).toBeTruthy();
    }
  });

  it('lands somewhere or nowhere for every label there is — never undefined', () => {
    for (const label of Object.keys(CONTEXT_LABELS) as ContextLabel[]) {
      const target = resolveContextJump(label);
      expect(target === null || typeof target.tab === 'string').toBe(true);
    }
  });
});
