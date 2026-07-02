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
    expect(tokensIn(defaultSystemPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION|descriptions>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION>',
      '<ENTITIES>',
      '<NOTES>',
      '<LENGTH GUIDANCE>',
      '<MARKDOWN GUIDANCE>',
    ]);
    // GameViewer's <NOTES>-absent fallback locates this exact label.
    expect(defaultSystemPrompt).toContain('Current Location:');
    // Positive contract: the narrator writes only story prose; a separate step handles choices.
    expect(defaultSystemPrompt).toContain("a separate step presents the player's choices");
    expect(defaultSystemPrompt).toContain('[Player\'s turn]');
    // Name-discipline: plan names are the narrator's private knowledge; introduce by description,
    // let a name reach the page only once the player would have learned it.
    expect(defaultSystemPrompt).toContain('what you know, not what the player knows');
    expect(defaultSystemPrompt).toContain("hasn't met by description");
    expect(defaultSystemPrompt).toContain('once the player would have learned it');
  });

  it('choices prompt', () => {
    expect(tokensIn(defaultChoicesPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION|descriptions>',
      '<TRAITS DESCRIPTION>',
      '<NOTES>',
      '<LOCATION|summary>',
      '<ENTITIES|summary>',
    ]);
    // First-person, single-sentence options — not the old terse-phrase-with-examples shape,
    // and without the literal `"I ..."` token that small models echo as a prefix.
    expect(defaultChoicesPrompt).toContain('single first-person sentence');
    expect(defaultChoicesPrompt).not.toContain('"I ..."');
    expect(defaultChoicesPrompt).not.toContain('1-6 words');
    expect(defaultChoicesPrompt).not.toContain('Forage for food');
  });

  it('stat-updates prompt', () => {
    expect(tokensIn(defaultStatUpdatesPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<NOTES>',
    ]);
  });

  it('location-change prompt', () => {
    expect(tokensIn(defaultLocationChangePrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<LOCATION>',
      '<ENTITIES>',
      '<LOCATION|list>',
    ]);
  });

  it('thinking (pre-call) prompt', () => {
    expect(tokensIn(defaultThinkingPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION|descriptions>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION|summary>',
      '<ENTITIES|summary>',
      '<NOTES>',
    ]);
    // Basic planning surfaces each present character's placement.
    expect(defaultThinkingPrompt).toContain('physically doing right now');
  });

  it('staged director prompt', () => {
    expect(tokensIn(defaultDirectorPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION|summary>',
      '<ENTITIES|summary>',
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
      '<TRAITS DESCRIPTION>',
      '<LOCATION|summary>',
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
      '<STATS DESCRIPTION|descriptions>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION|summary>',
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
  it('stat-updates and location user templates carry the narration token', () => {
    expect(tokensIn(defaultStatUpdatesUserPrompt)).toEqual(['<NARRATION>']);
    expect(tokensIn(defaultLocationChangeUserPrompt)).toEqual(['<NARRATION>']);
  });
  it('summary user template is just the narration token', () => {
    expect(tokensIn(defaultSummaryUserPrompt)).toEqual(['<NARRATION>']);
  });
});

describe('planDirective', () => {
  it('wraps the plan as a follow-it directive carrying the plan text', () => {
    const out = planDirective('Mira flees north.');
    expect(out).toContain('Mira flees north.');
    expect(out.toLowerCase()).toContain('follow the plan');
    expect(out.toLowerCase()).toContain('flowing prose');
  });
});

describe('markdownGuidance', () => {
  it('returns the floor-based formatting block when enabled', () => {
    const on = markdownGuidance(true);
    expect(on).toContain('Bold exactly one');
    expect(on).toContain('Markdown table');
    expect(on).toContain('Italicize at least one');
  });

  it('returns a plain-prose directive when disabled', () => {
    const off = markdownGuidance(false);
    expect(off).toContain('plain prose');
    expect(off).not.toContain('Markdown table');
    expect(off).not.toContain('Bold exactly');
  });
});
