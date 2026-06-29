import { describe, it, expect } from 'vitest';
import {
  defaultSystemPrompt,
  defaultChoicesPrompt,
  defaultStatUpdatesPrompt,
  defaultLocationChangePrompt,
  defaultThinkingPrompt,
  markdownGuidance,
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
      '<LOCATION JSON DATA>',
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
      '<LOCATION JSON DATA|summary>',
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
      '<LOCATION JSON DATA>',
      '<LOCATION LIST>',
    ]);
  });

  it('thinking (pre-call) prompt', () => {
    expect(tokensIn(defaultThinkingPrompt)).toEqual([
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION JSON DATA|summary>',
      '<NOTES>',
    ]);
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
