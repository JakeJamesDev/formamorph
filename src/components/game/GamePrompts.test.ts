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
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION>',
      '<ENTITIES>',
      '<NOTES>',
      '<LENGTH GUIDANCE>',
      '<MARKDOWN GUIDANCE>',
    ]);
    // GameViewer's <NOTES>-absent fallback locates this exact label.
    expect(defaultSystemPrompt).toContain('Current Location:');
  });

  it('choices prompt', () => {
    expect(tokensIn(defaultChoicesPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<NOTES>',
      '<LOCATION|summary>',
      '<ENTITIES|summary>',
    ]);
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
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION|summary>',
      '<ENTITIES|summary>',
      '<NOTES>',
    ]);
  });

  it('staged director prompt', () => {
    expect(tokensIn(defaultDirectorPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<LOCATION|summary>',
      '<ENTITIES|summary>',
      '<NOTES>',
    ]);
  });

  it('staged character prompt', () => {
    expect(tokensIn(defaultCharacterPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<LOCATION|summary>',
    ]);
  });

  it('staged storyboard prompt', () => {
    expect(tokensIn(defaultStoryboardPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION|summary>',
      '<NOTES>',
    ]);
  });
});

describe('planDirective', () => {
  it('wraps the plan as a follow-it directive carrying the plan text', () => {
    const out = planDirective('Mira flees north.');
    expect(out).toContain('Mira flees north.');
    expect(out.toLowerCase()).toContain('follow it');
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
