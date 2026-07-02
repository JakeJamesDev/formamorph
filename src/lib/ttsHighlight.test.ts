// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  positionToSentenceIndex,
  buildCharMap,
  findSentenceRange,
  findNthSentenceRange,
  segmentRangeByIndex,
  sentenceRange,
} from './ttsHighlight';

describe('positionToSentenceIndex', () => {
  const chunks = [
    { start: 0, sentenceIndex: 0 },
    { start: 2, sentenceIndex: 1 },
    { start: 2.5, sentenceIndex: 1 }, // over-long sentence: two chunks, one index
    { start: 4, sentenceIndex: 2 },
  ];

  it('returns -1 when there are no chunks', () => {
    expect(positionToSentenceIndex([], 3)).toBe(-1);
  });

  it('maps the playhead to the last chunk at or before it', () => {
    expect(positionToSentenceIndex(chunks, 0)).toBe(0);
    expect(positionToSentenceIndex(chunks, 1.9)).toBe(0);
    expect(positionToSentenceIndex(chunks, 2)).toBe(1);
    expect(positionToSentenceIndex(chunks, 2.7)).toBe(1); // still the over-long sentence
    expect(positionToSentenceIndex(chunks, 5)).toBe(2);   // past the end → last sentence
  });
});

/** Render HTML into a detached container for DOM-range tests. */
function container(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('buildCharMap', () => {
  it('flattens text across inline elements', () => {
    const map = buildCharMap(container('He <strong>left</strong> now.'));
    expect(map.text).toBe('He left now.');
    expect(map.charAt.length).toBe(map.text.length);
  });
});

describe('findSentenceRange', () => {
  it('locates a sentence spanning multiple text nodes (bold inside)', () => {
    const el = container('He <em>ran</em> away. Then he hid.');
    const map = buildCharMap(el);
    const found = findSentenceRange(map, 'He ran away.', 0);
    expect(found).not.toBeNull();
    expect(found!.range.toString()).toBe('He ran away.');
  });

  it('matches whitespace-flexibly (needle spaces vs rendered newlines)', () => {
    const el = container('He ran\n away.');
    const map = buildCharMap(el);
    const found = findSentenceRange(map, 'He ran away.', 0);
    expect(found).not.toBeNull();
    expect(found!.range.toString().replace(/\s+/g, ' ')).toBe('He ran away.');
  });

  it('returns null when the needle is absent', () => {
    const map = buildCharMap(container('Nothing here.'));
    expect(findSentenceRange(map, 'Missing sentence.', 0)).toBeNull();
  });
});

describe('findNthSentenceRange', () => {
  it('walks a forward cursor so duplicate sentences resolve in order', () => {
    const el = container('Go now. Go now. Stay.');
    const map = buildCharMap(el);
    const texts = ['Go now.', 'Go now.', 'Stay.'];
    // Both "Go now." resolve to their own occurrence; the third is "Stay."
    expect(findNthSentenceRange(map, texts, 2)!.toString()).toBe('Stay.');
  });

  it('returns null when a sentence text is missing (count mismatch)', () => {
    const map = buildCharMap(container('One. Two.'));
    expect(findNthSentenceRange(map, ['One.'], 1)).toBeNull();
  });
});

describe('segmentRangeByIndex (fallback)', () => {
  it('segments the rendered text by sentence boundary', () => {
    const map = buildCharMap(container('First one. Second two! Third three?'));
    expect(segmentRangeByIndex(map, 0)!.toString()).toBe('First one.');
    expect(segmentRangeByIndex(map, 1)!.toString()).toBe('Second two!');
    expect(segmentRangeByIndex(map, 2)!.toString()).toBe('Third three?');
  });

  it('returns null for an out-of-range index', () => {
    const map = buildCharMap(container('Only one.'));
    expect(segmentRangeByIndex(map, 3)).toBeNull();
  });
});

describe('sentenceRange', () => {
  it('falls back to index-segmentation when the needle cannot be anchored', () => {
    const el = container('Alpha beta. Gamma delta.');
    // Needle text diverges from the DOM, so anchor-by-text fails and it falls back by index.
    const range = sentenceRange(el, ['totally different', 'gamma delta.'], 1);
    expect(range!.toString()).toBe('Gamma delta.');
  });

  it('returns null for a negative index', () => {
    expect(sentenceRange(container('Hi.'), ['Hi.'], -1)).toBeNull();
  });
});
