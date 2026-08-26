import { describe, it, expect } from 'vitest';
import { resolvePromptJump, PROMPT_TAB_FOR_REQUEST } from './promptJump';
import { SOURCE_LABELS, type AnatomySource } from './requestAnatomy';
import { allGroupedTabs } from './promptGroups';
import type { AIRequestType } from '@/types';

/**
 * Where a click on a highlighted run goes. What matters here is that every authored run across every pass
 * resolves to a prompt the rail really lists and an editor that really exists, and that a run on a call
 * with no editor behind it resolves to nothing at all.
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
