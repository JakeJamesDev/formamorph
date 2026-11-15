import { describe, it, expect } from 'vitest';
import { blockQuotes, matchQuoteSpeakers, spokenQuotes, type QuoteSpeakerSource } from './quoteSegments';

// The renderer can hand the quote plugin one markdown block at a time. These cover the block-level pairing
// that a whole-passage render never reaches.

const COLORS = new Map<string, string>();
const PARAGRAPH = '"Yes," she says.';

const passage = (text: string, lines: [string, string | null][]): QuoteSpeakerSource =>
  ({ text, colors: COLORS, quotes: spokenQuotes(text, lines) });

describe('blockQuotes', () => {
  it("gives a block the reading's quotes inside it, keyed without markdown", () => {
    const text = 'Intro.\n\n"Hold the **line**," Mira says.';
    const source = passage(text, [['"Hold the **line**,"', 'mira']]);
    expect(blockQuotes(source, '"Hold the **line**," Mira says.\n')).toEqual([{ key: '"Hold the line,"', speaker: 'mira' }]);
    expect(blockQuotes(source, 'Intro.\n\n')).toEqual([]);
  });

  it('gives nothing to a block that repeats with other speakers', () => {
    const source = passage(`${PARAGRAPH}\n\n${PARAGRAPH}`, [['"Yes,"', 'mira'], ['"Yes,"', 'kessa']]);
    expect(blockQuotes(source, PARAGRAPH)).toEqual([]);
  });

  it('keeps the speakers of a block that repeats with the same ones', () => {
    const source = passage(`${PARAGRAPH}\n\n${PARAGRAPH}`, [['"Yes,"', 'mira'], ['"Yes,"', 'mira']]);
    expect(blockQuotes(source, PARAGRAPH)).toEqual([{ key: '"Yes,"', speaker: 'mira' }]);
  });

  it('gives nothing to a block the passage does not hold', () => {
    expect(blockQuotes(passage(PARAGRAPH, [['"Yes,"', 'mira']]), '"No," she says.')).toEqual([]);
  });
});

describe('matchQuoteSpeakers', () => {
  it('skips a reading quote the render never showed, without shifting the rest', () => {
    const quotes = [{ key: '"a"', speaker: 'x' }, { key: '"b"', speaker: 'y' }];
    expect(matchQuoteSpeakers([{ text: '"b"', open: false }], quotes)).toEqual(['y']);
  });

  it('leaves a rendered quote with no reading quote unattributed', () => {
    expect(matchQuoteSpeakers([{ text: '"c"', open: false }], [{ key: '"a"', speaker: 'x' }])).toEqual([null]);
  });
});
