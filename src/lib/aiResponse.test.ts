import { describe, it, expect } from 'vitest';
import { parseGameText, stripReasoning, stripReasoningLive } from './aiResponse';

describe('parseGameText', () => {
  it('returns game_text from strict JSON', () => {
    expect(parseGameText('{"game_text":"You enter the cave."}')).toBe('You enter the cave.');
  });

  it('parses lenient JSON5 (unquoted key, single quotes, trailing comma)', () => {
    expect(parseGameText("{ game_text: 'hi there', }")).toBe('hi there');
  });

  it('trims surrounding whitespace before parsing', () => {
    expect(parseGameText('  \n {"game_text":"trimmed"} \n ')).toBe('trimmed');
  });

  it('falls back to regex extraction when there is trailing garbage', () => {
    expect(parseGameText('{"game_text":"recovered"} <<junk>>')).toBe('recovered');
  });

  it('returns a placeholder when the parsed object has no game_text', () => {
    expect(parseGameText('{"choices":["a","b"]}')).toBe('No game text available');
  });

  it('returns the error placeholder for unparseable content', () => {
    expect(parseGameText('this is not json at all')).toBe(
      'Error parsing message. Please check console for details.',
    );
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
