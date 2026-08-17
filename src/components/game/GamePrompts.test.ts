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
  defaultOocDirectivePrompt,
  hasOocDirective,
  stripOocDirectives,
  markdownGuidance,
  activeCharacterGuidance,
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
      // Last, where recency makes a small model honor it — and where the code-side append used to sit.
      '<LANGUAGE>',
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
      '<LANGUAGE>',
    ]);
  });

  it('stat-updates prompt', () => {
    expect(tokensIn(defaultStatUpdatesPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION|numbers.meaning.markdown>',
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
    // The reframed continuity planner (director+storyboarder fusion) drops the stats chip - the narrator,
    // not the plan, owns outcome, so stats are noise here. Same context set as the staged director.
    expect(tokensIn(defaultThinkingPrompt)).toEqual([
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
      '<ACTIVE CHARACTER GUIDANCE>',
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
  it('active-character guidance reflects the limit setting', () => {
    // Low cap: the "keep it small" nudge.
    const small = activeCharacterGuidance(true, 2);
    expect(small).toContain('one to 2');
    expect(small.toLowerCase()).toContain('small');
    // Higher cap: neutral wording that never calls a large number "small".
    const large = activeCharacterGuidance(true, 10);
    expect(large).toContain('up to 10');
    expect(large.toLowerCase()).not.toContain('small');
    // Disabled: unbounded.
    const off = activeCharacterGuidance(false, 5);
    expect(off).not.toContain('one to');
    expect(off.toLowerCase()).toContain('as many');
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

describe('OOC channel', () => {
  it('hasOocDirective detects a square-bracket directive anywhere in the action', () => {
    expect(hasOocDirective('I swing up behind her. [She agrees and they ride on.]')).toBe(true);
    expect(hasOocDirective('[Skip ahead to dusk.] I keep walking.')).toBe(true);
  });

  it('hasOocDirective ignores bracket-free, empty-bracket, and unclosed-bracket actions', () => {
    expect(hasOocDirective('I ask her what she is running from.')).toBe(false);
    expect(hasOocDirective('I mark the crate [] and move on.')).toBe(false);
    expect(hasOocDirective('I shout [into the dark')).toBe(false);
  });

  it('the rider is a single line composed after the action', () => {
    expect(defaultOocDirectivePrompt).not.toContain('\n');
  });

  it('stripOocDirectives removes bracket directives and tidies the seams', () => {
    expect(stripOocDirectives('I swing up behind her. [She agrees and they ride on.]')).toBe('I swing up behind her.');
    expect(stripOocDirectives('[Skip ahead.] I keep walking. [At dusk.]')).toBe('I keep walking.');
    expect(stripOocDirectives('I hand over the coin [he takes it gladly] and wait.')).toBe('I hand over the coin and wait.');
  });

  it('stripOocDirectives leaves bracket-free actions untouched', () => {
    expect(stripOocDirectives('I ask her what she is running from.')).toBe('I ask her what she is running from.');
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
