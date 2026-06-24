import { describe, it, expect } from 'vitest';
import {
  defaultSystemPrompt,
  defaultChoicesPrompt,
  defaultStatUpdatesPrompt,
  defaultLocationChangePrompt,
  defaultThinkingPrompt,
} from './GamePrompts';

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

// Each placeholder must appear exactly once: GameViewer substitutes them with a literal
// String.replace(), which only swaps the first occurrence.
const expectTokensOnce = (prompt: string, tokens: string[]) => {
  for (const t of tokens) expect(occurrences(prompt, t)).toBe(1);
};

describe('default prompts keep the placeholder contract', () => {
  it('game-text prompt has its tokens (once each) and the Current Location label', () => {
    expectTokensOnce(defaultSystemPrompt, [
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION JSON DATA>',
      '<NOTES>',
    ]);
    // GameViewer's <NOTES>-absent fallback locates this exact label.
    expect(defaultSystemPrompt).toContain('Current Location:');
  });

  it('choices prompt has its tokens once each', () => {
    expectTokensOnce(defaultChoicesPrompt, [
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<NOTES>',
      '<LOCATION JSON DATA>',
    ]);
  });

  it('stat-updates prompt has its tokens once each', () => {
    expectTokensOnce(defaultStatUpdatesPrompt, [
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<NOTES>',
    ]);
  });

  it('location-change prompt has its tokens once each', () => {
    expectTokensOnce(defaultLocationChangePrompt, [
      '<WORLD DESCRIPTION>',
      '<LOCATION JSON DATA>',
      '<LOCATION LIST>',
    ]);
  });

  it('thinking (pre-call) prompt has its tokens once each', () => {
    expectTokensOnce(defaultThinkingPrompt, [
      '<WORLD DESCRIPTION>',
      '<STATS DESCRIPTION>',
      '<TRAITS DESCRIPTION>',
      '<LOCATION JSON DATA>',
      '<NOTES>',
    ]);
  });
});
