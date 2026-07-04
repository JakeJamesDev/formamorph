import { describe, it, expect } from 'vitest';
import {
  defaultSystemPrompt,
  defaultChoicesPrompt,
  defaultStatUpdatesPrompt,
  defaultLocationChangePrompt,
  defaultThinkingPrompt,
  defaultDirectorPrompt,
  defaultCharacterPrompt,
  defaultStoryboardPrompt,
  defaultDiaryPrompt,
  defaultChoicesUserPrompt,
  defaultDirectorUserPrompt,
  defaultStatUpdatesUserPrompt,
  defaultLocationChangeUserPrompt,
  defaultSummaryUserPrompt,
  OPENING_SCENE_CUE,
  markdownGuidance,
  planDirective,
} from './GamePrompts';
import { parsePromptTemplate } from '@/lib/promptTemplate';

// The variable chips a prompt injects, in order. This is the mechanical contract we guard: each default
// prompt must carry exactly the context tokens it's meant to, so an edit can't silently drop or reorder
// injected context (e.g. lose <DICTIONARY>). Prompt *wording* is a quality matter measured by the baseline
// harness (npm run baseline), not pinned here — so these tests pass on a reword and fail on a dropped token.
const tokensIn = (prompt: string): string[] =>
  parsePromptTemplate(prompt).flatMap((s) => (s.type === 'variable' ? [s.token] : []));

describe('default prompts carry the expected variable chips', () => {
  it('game-text prompt', () => {
    expect(tokensIn(defaultSystemPrompt)).toEqual([
      '<LENGTH GUIDANCE>',
      '<MARKDOWN GUIDANCE>',
      '<WORLD DESCRIPTION>',
      '<DICTIONARY|before>',
      '<STATS DESCRIPTION|descriptions.markdown>',
      '<TRAITS DESCRIPTION|markdown>',
      '<NOTES>',
      '<LOCATION|markdown>',
      '<LOCATION|sublocations.summary.markdown>',
      '<LOCATION|reachable.summary.markdown>',
      '<ENTITIES|markdown>',
      '<ENTITIES|sublocations.markdown>',
      '<ENTITIES|reachable.summary.markdown>',
      '<DICTIONARY>',
    ]);
  });

  it('choices prompt', () => {
    expect(tokensIn(defaultChoicesPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION|descriptions.markdown>',
      '<TRAITS DESCRIPTION|markdown>',
      '<NOTES>',
      '<LOCATION|summary.markdown>',
      '<LOCATION|sublocations.summary.markdown>',
      '<LOCATION|reachable.summary.markdown>',
      '<ENTITIES|summary.markdown>',
      '<ENTITIES|sublocations.summary.markdown>',
      '<ENTITIES|reachable.summary.markdown>',
    ]);
  });

  it('stat-updates prompt', () => {
    expect(tokensIn(defaultStatUpdatesPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION|numbers.markdown>',
      '<TRAITS DESCRIPTION|markdown>',
      '<NOTES>',
    ]);
  });

  it('location-change prompt', () => {
    expect(tokensIn(defaultLocationChangePrompt)).toEqual([
      '<LOCATION|summary.markdown>',
      '<LOCATION|destinations.summary.markdown>',
    ]);
  });

  it('thinking (pre-call) prompt', () => {
    expect(tokensIn(defaultThinkingPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION|descriptions.markdown>',
      '<TRAITS DESCRIPTION|markdown>',
      '<LOCATION|summary.markdown>',
      '<LOCATION|sublocations.summary.markdown>',
      '<LOCATION|reachable.summary.markdown>',
      '<ENTITIES|summary.markdown>',
      '<ENTITIES|sublocations.summary.markdown>',
      '<ENTITIES|reachable.summary.markdown>',
      '<NOTES>',
    ]);
  });

  it('staged director prompt', () => {
    expect(tokensIn(defaultDirectorPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<TRAITS DESCRIPTION|markdown>',
      '<LOCATION|summary.markdown>',
      '<LOCATION|sublocations.summary.markdown>',
      '<LOCATION|reachable.summary.markdown>',
      '<ENTITIES|summary.markdown>',
      '<ENTITIES|sublocations.summary.markdown>',
      '<ENTITIES|reachable.summary.markdown>',
      '<NOTES>',
    ]);
  });

  it('staged character prompt', () => {
    expect(tokensIn(defaultCharacterPrompt)).toEqual([
      '<CHARACTER NAME>',
      '<WORLD DESCRIPTION>',
      '<TRAITS DESCRIPTION|markdown>',
      '<LOCATION|summary.markdown>',
      '<LOCATION|sublocations.summary.markdown>',
      '<LOCATION|reachable.summary.markdown>',
    ]);
  });

  it('diary prompt carries no variable chips', () => {
    expect(tokensIn(defaultDiaryPrompt)).toEqual([]);
  });

  it('staged storyboard prompt', () => {
    expect(tokensIn(defaultStoryboardPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION|descriptions.markdown>',
      '<TRAITS DESCRIPTION|markdown>',
      '<LOCATION|summary.markdown>',
      '<LOCATION|sublocations.summary.markdown>',
      '<LOCATION|reachable.summary.markdown>',
      '<NOTES>',
    ]);
  });
});

describe('aux user-message templates carry the runtime value-tokens', () => {
  it('choices user template has only the narration token', () => {
    expect(tokensIn(defaultChoicesUserPrompt)).toEqual(['<NARRATION>']);
  });
  it('director user template carries the narration + player-action tokens', () => {
    expect(tokensIn(defaultDirectorUserPrompt)).toEqual(['<NARRATION>', '<PLAYER ACTION>']);
  });
  it('stat-updates user template carries the narration token', () => {
    expect(tokensIn(defaultStatUpdatesUserPrompt)).toEqual(['<NARRATION>']);
  });
  it('location user template carries only the player-action token', () => {
    expect(tokensIn(defaultLocationChangeUserPrompt)).toEqual(['<PLAYER ACTION>']);
  });
  it('summary user template carries the player-action + narration tokens', () => {
    expect(tokensIn(defaultSummaryUserPrompt)).toEqual(['<PLAYER ACTION>', '<NARRATION>']);
  });
});

describe('OPENING_SCENE_CUE', () => {
  // Anti-echo mechanical guard: a trailing question is a copy-magnet small models parrot back at the player.
  it('is phrased as an instruction, not a question', () => {
    expect(OPENING_SCENE_CUE).not.toContain('?');
  });
});

describe('planDirective', () => {
  it('carries the plan text through into the directive', () => {
    expect(planDirective('Mira flees north.')).toContain('Mira flees north.');
  });
});

describe('markdownGuidance', () => {
  // The toggle must actually toggle: enabled and disabled produce two distinct, non-empty directives.
  it('produces distinct, non-empty guidance for the enabled and disabled modes', () => {
    const on = markdownGuidance(true);
    const off = markdownGuidance(false);
    expect(on).toBeTruthy();
    expect(off).toBeTruthy();
    expect(on).not.toBe(off);
  });
});
