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
  defaultSummaryPrompt,
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

// The chips a prompt contains, in order. Substitution is now replaceAll, so a token may legitimately
// repeat; we assert the exact sequence the default ships with.
const tokensIn = (prompt: string): string[] =>
  parsePromptTemplate(prompt).flatMap((s) => (s.type === 'variable' ? [s.token] : []));

describe('default prompts carry the expected variable chips', () => {
  it('game-text prompt', () => {
    // Recency order: framing/guidance up top (primacy), static background in the middle, live scene +
    // dictionary last (recency), then the hard output contract as the final paragraph.
    expect(tokensIn(defaultSystemPrompt)).toEqual([
      '<LENGTH GUIDANCE>',
      '<MARKDOWN GUIDANCE>',
      '<WORLD DESCRIPTION>',
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
    // Canonical headers are markdown; the labels style downcasts them, and GameViewer's <NOTES>-absent
    // fallback locates the location header in either style.
    expect(defaultSystemPrompt).toContain('## Current Location');
    // Sub-location sections sit below their non-nested counterparts; the entities heading is reworded to
    // pair with the sub-location one.
    expect(defaultSystemPrompt).toContain('## Sublocations');
    expect(defaultSystemPrompt).toContain('## Reachable Locations');
    expect(defaultSystemPrompt).toContain('## Characters and things that may appear in this location');
    expect(defaultSystemPrompt).toContain('## Characters and things that may appear in a sub-location');
    expect(defaultSystemPrompt).toContain('## Characters and things that may appear in a reachable location');
    expect(defaultSystemPrompt).not.toContain('may appear here');
    // Positive contract: the narrator writes only story prose; a separate step handles choices.
    expect(defaultSystemPrompt).toContain("a separate step presents the player's choices");
    // Stat coloring is a standalone directive plus a co-located lead-in on the stats block (Run A1/A2: both
    // model tiers ignored the old buried clause). Positive contract, no example values.
    expect(defaultSystemPrompt).toContain('shape how each action turns out');
    expect(defaultSystemPrompt).toContain('low stats cost, high stats come easy');
    expect(defaultSystemPrompt).toContain('[Player\'s turn]');
    // Name-discipline: plan names are the narrator's private knowledge; introduce by description,
    // let a name reach the page only once the player would have learned it.
    expect(defaultSystemPrompt).toContain('what you know, not what the player knows');
    expect(defaultSystemPrompt).toContain("hasn't met by description");
    expect(defaultSystemPrompt).toContain('once the player would have learned it');
    // Recency: the live scene + dictionary sit late, and the hard output contract is the final block.
    expect(defaultSystemPrompt.indexOf('## Relevant Information'))
      .toBeLessThan(defaultSystemPrompt.indexOf('Output only the story prose'));
    expect(defaultSystemPrompt.indexOf('## Current Location'))
      .toBeGreaterThan(defaultSystemPrompt.indexOf('## Game World'));
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
    // First-person, single-sentence options — not the old terse-phrase-with-examples shape,
    // and without the literal `"I ..."` token that small models echo as a prefix.
    expect(defaultChoicesPrompt).toContain('single first-person sentence');
    expect(defaultChoicesPrompt).not.toContain('"I ..."');
    expect(defaultChoicesPrompt).not.toContain('1-6 words');
    expect(defaultChoicesPrompt).not.toContain('Forage for food');
  });

  it('stat-updates prompt', () => {
    // Stats render numbers-only (no descriptor) so the tracker can't echo "8/100 (Drained)" into its deltas.
    expect(tokensIn(defaultStatUpdatesPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION|numbers.markdown>',
      '<TRAITS DESCRIPTION|markdown>',
      '<NOTES>',
    ]);
    // Co-located cue + no copy-magnet example (small models copy example stat values verbatim).
    expect(defaultStatUpdatesPrompt).toContain("never a stat's value");
    expect(defaultStatUpdatesPrompt).not.toContain('## Example');
    expect(defaultStatUpdatesPrompt).not.toContain('Hunger');
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
    // Basic planning surfaces each present character's placement.
    expect(defaultThinkingPrompt).toContain('physically doing right now');
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
    // The director stages the scene, refers to the player in third person, and gives each a placement.
    expect(defaultDirectorPrompt).toContain('Scene:');
    expect(defaultDirectorPrompt).toContain('third person');
    expect(defaultDirectorPrompt).toContain('physically doing right now');
    // The player is always the first cast bullet, and the block must not repeat.
    expect(defaultDirectorPrompt).toContain('- Player Character -');
    expect(defaultDirectorPrompt).toContain('exactly one Scene line and one Cast list');
    // Agency is the cast gate: only individual beings that can act/speak; scenery, crowds, and places
    // (however alive-seeming) stay in the Scene, never the Cast.
    expect(defaultDirectorPrompt).toContain('cast only individual beings that can choose to act or speak this turn');
    expect(defaultDirectorPrompt).toContain('a place or crowd is not one being');
    // Invented characters need a concrete, reusable name — but naming never promotes scenery. No seeded names.
    expect(defaultDirectorPrompt).toContain('a concrete name it can be called by again next turn');
    expect(defaultDirectorPrompt).toContain('is a description, not a character');
    expect(defaultDirectorPrompt).toContain('never name a place, object, or scenery');
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
    // The character speaks in the first person but keeps the player in the third person.
    expect(defaultCharacterPrompt).toContain('first person');
    expect(defaultCharacterPrompt).toContain('never "you"');
    // Speech is reported as intent — the narrator writes the actual dialogue.
    expect(defaultCharacterPrompt).toContain('not quoted words');
  });

  it('diary prompt establishes the pronoun frame and self-anchor', () => {
    expect(tokensIn(defaultDiaryPrompt)).toEqual([]); // no variable chips
    // "you" in the account is the player; the named character is "I"; don't adopt the player's body.
    expect(defaultDiaryPrompt).toContain('"you" and "your" ALWAYS mean the player character');
    expect(defaultDiaryPrompt).toContain('"I" is always you');
    expect(defaultDiaryPrompt).toContain("never take on the player character's body");
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
    // Uses the current "scene" wording (not the old "continuation") and forbids scripting the player.
    expect(defaultStoryboardPrompt).not.toContain('continuation');
    expect(defaultStoryboardPrompt).toContain("director's scene");
    expect(defaultStoryboardPrompt).toContain("never decide the player character's own deliberate actions");
    // Dialogue is the narrator's job — the storyboard names intent, never quotes speech.
    expect(defaultStoryboardPrompt).toContain('never quote dialogue');
  });
});

describe('aux user-message templates carry the runtime value-tokens', () => {
  it('choices user template has only the narration token (last-action line was cut)', () => {
    expect(tokensIn(defaultChoicesUserPrompt)).toEqual(['<NARRATION>']);
  });
  it('director user template carries the narration + player-action tokens', () => {
    expect(tokensIn(defaultDirectorUserPrompt)).toEqual(['<NARRATION>', '<PLAYER ACTION>']);
  });
  it('stat-updates user template carries the narration token', () => {
    expect(tokensIn(defaultStatUpdatesUserPrompt)).toEqual(['<NARRATION>']);
  });
  it('location user template carries only the player-action token (reads the action, not the narration)', () => {
    expect(tokensIn(defaultLocationChangeUserPrompt)).toEqual(['<PLAYER ACTION>']);
  });
  it('summary user template carries the player-action + narration tokens, cue anchored last', () => {
    expect(tokensIn(defaultSummaryUserPrompt)).toEqual(['<PLAYER ACTION>', '<NARRATION>']);
    expect(defaultSummaryUserPrompt).toContain('Now retell this turn');
  });
  it('summary system prompt carries no proper-noun example (small models copy them verbatim)', () => {
    for (const name of ['Mira', 'Kael', 'north gate']) expect(defaultSummaryPrompt).not.toContain(name);
    expect(defaultSummaryPrompt).not.toContain('## Example');
  });
});

describe('OPENING_SCENE_CUE', () => {
  it('anchors the opening-scene task and restates the anti-question rule', () => {
    // Replaces the bare "START GAME" sentinel so the opening turn has a real instruction in the recency slot.
    expect(OPENING_SCENE_CUE).toContain('opening scene');
    expect(OPENING_SCENE_CUE).toContain('Do not ask the player');
  });
  it('carries no copy-magnet question the model would echo', () => {
    expect(OPENING_SCENE_CUE).not.toContain('What do you want');
    expect(OPENING_SCENE_CUE).not.toContain('?');
  });
});

describe('planDirective', () => {
  it('wraps the plan as narrator stage-directions carrying the plan text', () => {
    const out = planDirective('Mira flees north.');
    expect(out).toContain('Mira flees north.');
    // Framed as directions to the narrator, distinct from the player's own words.
    expect(out.toLowerCase()).toContain('narrator');
    expect(out.toLowerCase()).toContain('not words the player spoke');
    expect(out.toLowerCase()).toContain('flowing second-person prose');
  });
});

describe('markdownGuidance', () => {
  it('returns a lean, prose-first emphasis note when enabled', () => {
    const on = markdownGuidance(true);
    expect(on).toContain('flowing prose');
    expect(on).toContain('never a list, menu, or table');
    expect(on).toContain('emphasis');
    // No copy-verbatim examples, no rigid quota, no stat-table rule (which contradicted the Guidelines).
    expect(on).not.toContain('Markdown table');
    expect(on).not.toContain('Bold exactly one');
    expect(on).not.toContain('boot sinks');
  });

  it('returns a plain-prose directive when disabled', () => {
    const off = markdownGuidance(false);
    expect(off).toContain('plain prose');
    expect(off).not.toContain('Markdown table');
    expect(off).not.toContain('Bold exactly');
  });
});
