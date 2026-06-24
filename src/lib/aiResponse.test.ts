import { describe, it, expect } from 'vitest';
import { parseGameText } from './aiResponse';

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
