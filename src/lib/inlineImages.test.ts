import { describe, expect, it } from 'vitest';
import { narrationParts, shownSentences, type NarrationPart } from './inlineImages';
import type { ScriptImageTell } from './scriptTells';

const image = (id: string, sentence: number): ScriptImageTell => ({ image: id, size: 'medium', wrap: 'block', sentence, timing: 'output' });
const ALL = Number.POSITIVE_INFINITY;

/** The parts as one line each: a text run as written, an image by id. */
const lines = (parts: NarrationPart[]) => parts.map((part) => (part.kind === 'text' ? part.text.trim() : `[${part.image.image}]`));

describe('narrationParts', () => {
  const text = 'One. Two. Three.';

  it('puts an image after its anchor sentence and before the next', () => {
    expect(lines(narrationParts(text, [image('a', 1)], ALL))).toEqual(['One. Two.', '[a]', 'Three.']);
  });

  it('stacks images on one sentence in call order', () => {
    expect(lines(narrationParts(text, [image('a', 0), image('b', 0)], ALL))).toEqual(['One.', '[a]', '[b]', 'Two. Three.']);
  });

  it('cuts at each anchor, in sentence order whatever the call order', () => {
    expect(lines(narrationParts(text, [image('b', 1), image('a', 0)], ALL))).toEqual(['One.', '[a]', 'Two.', '[b]', 'Three.']);
  });

  it('puts an anchor past the last sentence after the last sentence (Q27)', () => {
    expect(lines(narrationParts(text, [image('a', 9)], ALL))).toEqual(['One. Two. Three.', '[a]']);
  });

  it('holds an anchor inside an open quote to where the quote ends (Q26)', () => {
    const quoted = 'She turns. "Wait. Look there." The gull lifts.';
    expect(lines(narrationParts(quoted, [image('a', 1)], ALL))).toEqual(['She turns. "Wait. Look there."', '[a]', 'The gull lifts.']);
  });

  it('ends a quote at a line break, as the renderer does', () => {
    const unclosed = '"Wait. Look\n\nThe gull lifts.';
    expect(lines(narrationParts(unclosed, [image('a', 0)], ALL))).toEqual(['"Wait. Look', '[a]', 'The gull lifts.']);
  });

  it('leaves an image out until its anchor sentence is on screen', () => {
    expect(lines(narrationParts(text, [image('a', 1)], 1))).toEqual(['One. Two. Three.']);
    expect(lines(narrationParts(text, [image('a', 1)], 2))).toEqual(['One. Two.', '[a]', 'Three.']);
  });

  it('never moves a live anchor back onto the last sentence shown so far', () => {
    expect(lines(narrationParts('One.', [image('a', 1)], 1))).toEqual(['One.']);
  });

  it('holds a live image while its quote is still open on screen', () => {
    expect(lines(narrationParts('"Wait. Look', [image('a', 0)], 2))).toEqual(['"Wait. Look']);
    expect(lines(narrationParts('"Wait. Look', [image('a', 0)], ALL))).toEqual(['"Wait. Look', '[a]']);
  });
});

describe('shownSentences', () => {
  it('counts every sentence once the turn settles', () => {
    expect(shownSentences('One. Tw', false, false)).toBe(ALL);
  });

  it('counts whole sentences in the fade reveal, and leaves out the crawl’s typing one (Q28)', () => {
    expect(shownSentences('One. Two.', true, true)).toBe(2);
    expect(shownSentences('One. Tw', true, false)).toBe(1);
    expect(shownSentences('', true, true)).toBe(0);
  });
});
