import { describe, it, expect } from 'vitest';
import { segmentQuotes } from './quoteSegments';

/** The segments as `"quoted"` / `plain` pairs, so a case reads as the text a player would see colored. */
function split(text: string, startOpen = false): { quoted: string[]; plain: string[]; open: boolean } {
  const { segments, open } = segmentQuotes(text, startOpen);
  return {
    quoted: segments.filter((s) => s.quoted).map((s) => s.text),
    plain: segments.filter((s) => !s.quoted).map((s) => s.text),
    open,
  };
}

describe('quote segmenter', () => {
  it('pairs straight quotes and keeps the marks inside the quoted run', () => {
    const { quoted, plain, open } = split('Mira said "hold the line" and left.');
    expect(quoted).toEqual(['"hold the line"']);
    expect(plain).toEqual(['Mira said ', ' and left.']);
    expect(open).toBe(false);
  });

  it('pairs curly quotes', () => {
    const { quoted, open } = split('Mira said “hold the line” and left.');
    expect(quoted).toEqual(['“hold the line”']);
    expect(open).toBe(false);
  });

  it('closes a straight opener on a curly closer and the other way round', () => {
    expect(split('"one” two').quoted).toEqual(['"one”']);
    expect(split('“one" two').quoted).toEqual(['“one"']);
  });

  it('leaves apostrophes and single quotes plain, inside a quote and out', () => {
    const { quoted, plain } = split("Ola's dog barked; 'no,' she said, \"it's Ola's.\"");
    expect(quoted).toEqual(['"it\'s Ola\'s."']);
    expect(plain).toEqual(["Ola's dog barked; 'no,' she said, "]);
  });

  it('runs an unclosed quote to the end of the input and reports it open', () => {
    const { quoted, open } = split('He shouted "run for the boat');
    expect(quoted).toEqual(['"run for the boat']);
    expect(open).toBe(true);
  });

  it('continues a quote that was already open when the run started', () => {
    const { quoted, plain, open } = split('for the boat" and ran.', true);
    expect(quoted).toEqual(['for the boat"']);
    expect(plain).toEqual([' and ran.']);
    expect(open).toBe(false);
  });

  it('keeps an empty quote as a quoted run of its two marks', () => {
    expect(split('She answered "" and shrugged.').quoted).toEqual(['""']);
  });

  it('keeps adjacent quotes apart', () => {
    expect(split('"yes""no"').quoted).toEqual(['"yes"', '"no"']);
  });

  it('treats guillemets and CJK marks as plain text', () => {
    const { quoted, plain } = split('«bonjour» and 「konnichiwa」');
    expect(quoted).toEqual([]);
    expect(plain).toEqual(['«bonjour» and 「konnichiwa」']);
  });

  it('returns nothing for empty text', () => {
    expect(segmentQuotes('')).toEqual({ segments: [], open: false });
  });

  it('gives back the text it was handed, mark for mark', () => {
    // Nothing may be dropped or duplicated: the segments are the whole line, in order.
    const text = 'A "b" c “d” e "f';
    expect(segmentQuotes(text).segments.map((s) => s.text).join('')).toBe(text);
  });
});
