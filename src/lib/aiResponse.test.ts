import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '@/types';
import { narrationOf, storyText, stripReasoning, stripReasoningLive, extractReasoning, extractReasoningLive } from './aiResponse';

describe('narrationOf', () => {
  it('returns narration from strict JSON', () => {
    expect(narrationOf('{"narration":"You enter the cave."}')).toBe('You enter the cave.');
  });

  it('parses lenient JSON5 (unquoted key, single quotes, trailing comma)', () => {
    expect(narrationOf("{ narration: 'hi there', }")).toBe('hi there');
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(narrationOf('  \n {"narration":"trimmed"} \n ')).toBe('trimmed');
  });

  it('recovers narration from truncated content by regex', () => {
    expect(narrationOf('{"narration":"recovered","choices":["a"')).toBe('recovered');
    expect(narrationOf('{"narration":"recovered"} <<junk>>')).toBe('recovered');
  });

  it('returns null when the parsed object has no narration', () => {
    expect(narrationOf('{"choices":["a","b"]}')).toBeNull();
  });

  it('returns null for unparseable content', () => {
    expect(narrationOf('this is not json at all')).toBeNull();
    expect(narrationOf('')).toBeNull();
  });

  // Backward compat: legacy v1.2 / pre-release 2.0 saves stored the narration under `game_text`.
  it('reads the legacy game_text field (object and regex-fallback paths)', () => {
    expect(narrationOf('{"game_text":"You enter the cave."}')).toBe('You enter the cave.');
    expect(narrationOf('{"game_text":"recovered"} <<junk>>')).toBe('recovered');
  });
});

describe('storyText', () => {
  const turn = (narration: string): ChatMessage => ({ role: 'assistant', content: JSON.stringify({ narration, choices: [], stat_changes: [] }) });

  it('leaves out turns that do not parse, with no error text', () => {
    const story = storyText([
      { role: 'user', content: 'go' },
      turn('First.'),
      { role: 'assistant', content: 'this is not json at all' },
      turn('<think>x</think>Third.'),
    ]);
    expect(story).toBe('First.\n\nThird.');
    expect(story).not.toMatch(/error|no narration/i);
  });
});

describe('stripReasoning', () => {
  it('removes a complete <think> block', () => {
    expect(stripReasoning('<think>plan here</think>You step in.')).toBe('You step in.');
  });

  it('removes multiple blocks and other tag names, case-insensitively', () => {
    const input = '<Think>a</Think>x<reasoning>b</reasoning>y<THOUGHT>c</THOUGHT>z';
    expect(stripReasoning(input)).toBe('xyz');
  });

  it('handles a multi-line block and an attribute on the tag', () => {
    expect(stripReasoning('<think foo="1">line1\nline2</think>Done.')).toBe('Done.');
  });

  it('leaves text without reasoning tags untouched', () => {
    expect(stripReasoning('Just narration, no tags.')).toBe('Just narration, no tags.');
  });

  it('does not strip a non-reasoning tag like <thinker>', () => {
    expect(stripReasoning('<thinker>keep</thinker>')).toBe('<thinker>keep</thinker>');
  });
});

describe('stripReasoningLive', () => {
  it('drops a trailing unclosed reasoning block (still streaming)', () => {
    expect(stripReasoningLive('Intro. <think>planning so far')).toBe('Intro. ');
  });

  it('drops a partial opening tag at the very end', () => {
    expect(stripReasoningLive('Intro. <think')).toBe('Intro. ');
  });

  it('removes a closed block and keeps the narration after it', () => {
    expect(stripReasoningLive('<think>x</think>You arrive.')).toBe('You arrive.');
  });

  it('leaves plain streaming text untouched', () => {
    expect(stripReasoningLive('You walk down the')).toBe('You walk down the');
  });
});

describe('extractReasoning', () => {
  it('returns the text inside a complete block (the inverse of stripReasoning)', () => {
    expect(extractReasoning('<think>plan here</think>You step in.')).toBe('plan here');
  });

  it('concatenates multiple blocks / tag names', () => {
    expect(extractReasoning('<think>a</think>x<reasoning>b</reasoning>')).toBe('a\n\nb');
  });

  it('is empty when there is no inline reasoning block', () => {
    expect(extractReasoning('Just narration.')).toBe('');
    expect(extractReasoning('')).toBe('');
  });
});

describe('extractReasoningLive', () => {
  it('includes the tail of an in-progress (unclosed) block', () => {
    expect(extractReasoningLive('<think>planning so f')).toBe('planning so f');
  });

  it('combines a completed block with an in-progress one', () => {
    expect(extractReasoningLive('<think>done</think>narration<think>more think')).toBe('done\n\nmore think');
  });

  it('returns the completed body once the block closes', () => {
    expect(extractReasoningLive('<think>all done</think>You arrive.')).toBe('all done');
  });
});
