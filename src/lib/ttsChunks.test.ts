import { describe, it, expect } from 'vitest';
import { splitForTTS, splitSentenceSegments } from './ttsChunks';

describe('splitSentenceSegments', () => {
  it('splits on terminator + whitespace and keeps terminators', () => {
    expect(splitSentenceSegments('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']);
  });

  it('leaves a trailing in-progress sentence as the last segment', () => {
    const segs = splitSentenceSegments('Done. In progres');
    expect(segs).toEqual(['Done.', 'In progres']);
    expect(segs.slice(0, -1)).toEqual(['Done.']); // "complete" sentences for streaming
  });

  it('returns a single segment when there is no boundary yet', () => {
    expect(splitSentenceSegments('No boundary here')).toEqual(['No boundary here']);
  });
});

describe('splitForTTS', () => {
  it('returns nothing for empty or whitespace-only text', () => {
    expect(splitForTTS('')).toEqual([]);
    expect(splitForTTS('   \n\t ')).toEqual([]);
  });

  it('returns short text as a single normalized chunk', () => {
    expect(splitForTTS('Hello world.')).toEqual(['Hello world.']);
  });

  it('collapses interior whitespace and newlines', () => {
    expect(splitForTTS('Hello   world.\n\nHow are   you?', 100)).toEqual([
      'Hello world. How are you?',
    ]);
  });

  it('packs multiple sentences into chunks under the budget', () => {
    const text = 'One sentence here. Two sentence here. Three sentence here. Four sentence here.';
    const chunks = splitForTTS(text, 40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(40);
    // Round-trips to the original words in order.
    expect(chunks.join(' ')).toBe(text);
  });

  it('keeps an over-long single sentence as its own chunk', () => {
    const long = 'word '.repeat(50).trim() + '.'; // ~255 chars, no internal terminator
    const chunks = splitForTTS(long, 100);
    expect(chunks).toEqual([long]);
    expect(chunks[0].length).toBeGreaterThan(100);
  });
});
