import { describe, it, expect } from 'vitest';
import { parsePromptTemplate, serializeSegments, renderPromptTemplate } from './promptTemplate';
import {
  defaultSystemPrompt, defaultChoicesPrompt, defaultStatUpdatesPrompt,
  defaultLocationChangePrompt, defaultThinkingPrompt, defaultSummaryPrompt,
} from '@/components/game/GamePrompts';

describe('renderPromptTemplate', () => {
  it('replaces every occurrence of a token, not just the first', () => {
    const out = renderPromptTemplate('<NOTES> ... <NOTES>', { '<NOTES>': 'X' });
    expect(out).toBe('X ... X');
  });

  it('substitutes multiple distinct tokens', () => {
    const out = renderPromptTemplate('A <WORLD DESCRIPTION> B <NOTES>', {
      '<WORLD DESCRIPTION>': 'world',
      '<NOTES>': 'notes',
    });
    expect(out).toBe('A world B notes');
  });

  it('leaves a token untouched when no value is provided', () => {
    expect(renderPromptTemplate('keep <NOTES>', {})).toBe('keep <NOTES>');
  });

  it('ignores unknown angle-bracket text', () => {
    expect(renderPromptTemplate('<NOT A VAR>', { '<NOT A VAR>': 'x' })).toBe('<NOT A VAR>');
  });
});

describe('parsePromptTemplate', () => {
  it('splits text and known variables in order', () => {
    expect(parsePromptTemplate('Hi <NOTES>!')).toEqual([
      { type: 'text', value: 'Hi ' },
      { type: 'variable', token: '<NOTES>' },
      { type: 'text', value: '!' },
    ]);
  });

  it('keeps unknown <...> as literal text', () => {
    expect(parsePromptTemplate('a <UNKNOWN> b')).toEqual([{ type: 'text', value: 'a <UNKNOWN> b' }]);
  });

  it('handles empty input', () => {
    expect(parsePromptTemplate('')).toEqual([]);
  });
});

describe('parse ∘ serialize round-trip', () => {
  const prompts: [string, string][] = [
    ['gametext', defaultSystemPrompt],
    ['choices', defaultChoicesPrompt],
    ['statUpdates', defaultStatUpdatesPrompt],
    ['locationChange', defaultLocationChangePrompt],
    ['thinking', defaultThinkingPrompt],
    ['summary', defaultSummaryPrompt],
  ];
  it.each(prompts)('is byte-identical for the %s default prompt', (_name, prompt) => {
    expect(serializeSegments(parsePromptTemplate(prompt))).toBe(prompt);
  });

  it('round-trips text with repeated tokens and newlines', () => {
    const src = 'line1\n<NOTES>\n\nline2 <WORLD DESCRIPTION> tail\n<NOTES>';
    expect(serializeSegments(parsePromptTemplate(src))).toBe(src);
  });
});
