import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { QUOTE_CLASS, spokenQuotes, type QuoteSpeakerSource } from '@/lib/quoteSegments';
import { speakerColors } from '@/lib/coref/speakerPalette';

// Runs the real renderer with a fake reading: what counts is what reaches the DOM after the parse, the
// sanitizer and the quote plugin, block by block.

const COLORS = speakerColors([{ id: 'mira' }, { id: 'kessa' }, { id: 'courier' }]);
const colorOf = (id: string) => COLORS.get(id);

/** A canned reading of `text`: each `[quote, speaker]` found in order. */
const source = (text: string, quotes: [string, string | null][], colors = COLORS): QuoteSpeakerSource =>
  ({ text, colors, quotes: spokenQuotes(text, quotes) });

function spans(text: string, speakers?: QuoteSpeakerSource, dialogue = true): HTMLElement[] {
  const { container } = render(<MarkdownRenderer text={text} dialogue={dialogue} speakers={speakers} />);
  return [...container.querySelectorAll<HTMLElement>(`.${QUOTE_CLASS}`)];
}

const said = (span: HTMLElement) => [span.textContent, span.dataset.speaker ?? null, span.style.getPropertyValue('--quote-speaker') || null];

const PASSAGE = [
  '"You said noon," Kessa says. "I said after the tide." Mira knots the rope.',
  'The courier lifts a hand. "Don\'t drag me into this."',
  'Someone calls out: "Both of you, the tide won\'t wait."',
].join('\n\n');

describe('speaker colors in the markdown renderer', () => {
  it('gives each resolved quote its speaker and color, across paragraphs', () => {
    const reading = source(PASSAGE, [
      ['"You said noon,"', 'kessa'], ['"I said after the tide."', 'mira'],
      ['"Don\'t drag me into this."', 'courier'], ['"Both of you, the tide won\'t wait."', null],
    ]);
    expect(spans(PASSAGE, reading).map(said)).toEqual([
      ['"You said noon,"', 'kessa', colorOf('kessa')],
      ['"I said after the tide."', 'mira', colorOf('mira')],
      ['"Don\'t drag me into this."', 'courier', colorOf('courier')],
      ['"Both of you, the tide won\'t wait."', null, null],
    ]);
  });

  it('colors every piece of a quote that emphasis splits', () => {
    const text = 'Mira said "hold the **line** now" and left.';
    const result = spans(text, source(text, [['"hold the **line** now"', 'mira']]));
    expect(result.map(said)).toEqual([
      ['"hold the ', 'mira', colorOf('mira')],
      ['line', 'mira', colorOf('mira')],
      [' now"', 'mira', colorOf('mira')],
    ]);
  });

  it('tells identical quotes apart by their place in the passage', () => {
    const text = '"Yes," Mira says.\n\n"Yes," Kessa says.';
    const result = spans(text, source(text, [['"Yes,"', 'mira'], ['"Yes,"', 'kessa']]));
    expect(result.map((span) => span.dataset.speaker)).toEqual(['mira', 'kessa']);
  });

  it('tells a repeated paragraph apart by its place in the passage', () => {
    const text = '"Yes," she says.\n\n"Yes," she says.';
    const result = spans(text, source(text, [['"Yes,"', 'mira'], ['"Yes,"', 'kessa']]));
    expect(result.map((span) => span.dataset.speaker ?? null)).toEqual(['mira', 'kessa']);
  });

  it('colors the part of a quote a line break cut short', () => {
    const text = 'She said "hold the line\nand wait" before dawn.';
    const result = spans(text, source(text, [['"hold the line\nand wait"', 'mira']]));
    expect(result.map((span) => span.dataset.speaker ?? null)).toEqual(['mira', null]);
  });

  it('keeps a closed quote apart from an unclosed one after it on the same line', () => {
    const text = '"Wait," Kessa says. Mira shrugs: "The tide';
    const result = spans(text, source(text, [['"Wait,"', 'kessa'], ['"The tide', 'mira']]));
    expect(result.map((span) => span.dataset.speaker ?? null)).toEqual(['kessa', 'mira']);
  });

  it('leaves a quote unresolved when its speaker left the cast', () => {
    const text = '"Wait," Kessa says.';
    const result = spans(text, source(text, [['"Wait,"', 'kessa']], speakerColors([{ id: 'mira' }])));
    expect(result.map(said)).toEqual([['"Wait,"', null, null]]);
  });

  it('leaves quotes as they are without a reading', () => {
    expect(spans(PASSAGE).map(said)).toEqual(spans(PASSAGE, undefined).map(said));
    expect(spans(PASSAGE).every((span) => !span.dataset.speaker && !span.getAttribute('style'))).toBe(true);
  });

  it('colors nothing when the reading belongs to another passage', () => {
    const other = '"You said noon," Kessa says, and walks away.';
    const result = spans(PASSAGE, source(other, [['"You said noon,"', 'kessa']]));
    expect(result.every((span) => !span.dataset.speaker)).toBe(true);
  });

  it('repaints a mounted passage when a new reading changes its speakers', () => {
    const live = render(<MarkdownRenderer text={PASSAGE} dialogue speakers={source(PASSAGE, [['"You said noon,"', 'kessa']])} />);
    const next = source(PASSAGE, [['"You said noon,"', 'mira']]);
    live.rerender(<MarkdownRenderer text={PASSAGE} dialogue speakers={next} />);
    const fresh = render(<MarkdownRenderer text={PASSAGE} dialogue speakers={next} />);
    expect(live.container.innerHTML).toBe(fresh.container.innerHTML);
    expect(live.container.querySelector<HTMLElement>(`.${QUOTE_CLASS}`)!.dataset.speaker).toBe('mira');
  });

  it('keeps speakers off a renderer without dialogue', () => {
    expect(spans(PASSAGE, source(PASSAGE, [['"You said noon,"', 'kessa']]), false)).toEqual([]);
  });

  it('colors a streaming quote that the shown text cuts after its first sentence (Q72)', () => {
    const arrived = 'The keeper shrugs. "North, toward the mill. She had a boy with her."';
    const shown = 'The keeper shrugs. "North, toward the mill.';
    const result = spans(shown, source(arrived, [['"North, toward the mill. She had a boy with her."', 'mira']]));
    expect(result.map(said)).toEqual([['"North, toward the mill.', 'mira', colorOf('mira')]]);
  });

  it('marks a quote the full-turn reading recolors with the color it streamed in with', () => {
    const text = '"You said noon," Kessa says.';
    const reading: QuoteSpeakerSource = { ...source(text, [['"You said noon,"', 'kessa']]), recolor: new Map([['0:16', colorOf('mira')!]]) };
    const [span] = spans(text, reading);
    expect(span.hasAttribute('data-quote-recolor')).toBe(true);
    expect(span.style.getPropertyValue('--quote-from')).toBe(colorOf('mira'));
    expect(span.style.getPropertyValue('--quote-speaker')).toBe(colorOf('kessa'));
  });
});
