import { describe, it, expect } from 'vitest';
import { parseNarration, stripReasoning, stripReasoningLive } from './aiResponse';

describe('parseNarration', () => {
  it('returns narration from strict JSON', () => {
    expect(parseNarration('{"narration":"You enter the cave."}')).toBe('You enter the cave.');
  });

  it('parses lenient JSON5 (unquoted key, single quotes, trailing comma)', () => {
    expect(parseNarration("{ narration: 'hi there', }")).toBe('hi there');
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseNarration('  \n {"narration":"trimmed"} \n ')).toBe('trimmed');
  });

  it('falls back to regex extraction when there is trailing garbage', () => {
    expect(parseNarration('{"narration":"recovered"} <<junk>>')).toBe('recovered');
  });

  it('returns a placeholder when the parsed object has no narration', () => {
    expect(parseNarration('{"choices":["a","b"]}')).toBe('No narration available');
  });

  it('returns the error placeholder for unparseable content', () => {
    expect(parseNarration('this is not json at all')).toBe(
      'Error parsing message. Please check console for details.',
    );
  });

  // Backward compat: legacy v1.2 / pre-release 2.0 saves stored the narration under `game_text`.
  it('reads the legacy game_text field (object and regex-fallback paths)', () => {
    expect(parseNarration('{"game_text":"You enter the cave."}')).toBe('You enter the cave.');
    expect(parseNarration('{"game_text":"recovered"} <<junk>>')).toBe('recovered');
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
