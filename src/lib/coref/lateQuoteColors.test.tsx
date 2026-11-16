// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { QUOTE_CLASS, UNCOLORED } from '@/lib/quoteSegments';
import { createStreamingQuoteReader, type ReadQuotes } from './streamingQuotes';
import { liveQuoteSpeakers } from './quoteSpeakers';
import { speakerColors } from './speakerPalette';

// A quote already on screen (reveal skipped, or a hold hit its cap) takes its color when its run ends, with no
// remount, so Streamdown's finished block never redraws for it.

let n = 0;
// Streamdown reuses output for identical text, so each test reads its own passage.
const passage = () => `"Hold the line," Mira says. The tide turns ${++n}.

Kessa nods.`;
const COLORS = speakerColors([{ id: 'mira' }]);

function setup(runMs: number) {
  const read: ReadQuotes = (passage) => new Promise((resolve) => setTimeout(() => {
    resolve([...passage.matchAll(/"[^"]*"/g)].map((m) => ({ start: m.index, end: m.index + m[0].length, speaker: 'mira' })));
  }, runMs));
  const reader = createStreamingQuoteReader();
  reader.begin(read);
  const speakers = liveQuoteSpeakers(reader.live(), COLORS);
  return { reader, speakers, text: passage() };
}

const quote = (container: HTMLElement) => container.querySelector<HTMLElement>(`.${QUOTE_CLASS}`)!;

describe('late quote colors', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  it('colors a quote already on screen when its run ends, fading from the default color', async () => {
    const { reader, speakers, text } = setup(100);
    reader.update(text, true);
    // Shown at once, before the run ends: the skip and hold-cap case.
    const { container } = render(<MarkdownRenderer text={text} dialogue speakers={speakers} />);
    expect(quote(container).dataset.speaker).toBeUndefined();
    expect(quote(container).hasAttribute('data-quote-span')).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(100); });

    const span = quote(container);
    expect(span.dataset.speaker).toBe('mira');
    expect(span.style.getPropertyValue('--quote-speaker')).toBe(COLORS.get('mira'));
    expect(span.style.getPropertyValue('--quote-from')).toBe(UNCOLORED);
    expect(span.hasAttribute('data-quote-recolor')).toBe(true);
  });

  it('drops the recolor mark once the fade ends, so a later recolor fades again', async () => {
    const { reader, speakers, text } = setup(100);
    reader.update(text, true);
    const { container } = render(<MarkdownRenderer text={text} dialogue speakers={speakers} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    const span = quote(container);
    expect(span.hasAttribute('data-quote-recolor')).toBe(true);
    span.dispatchEvent(new Event('animationend'));
    expect(span.hasAttribute('data-quote-recolor')).toBe(false);
    expect(span.dataset.speaker).toBe('mira');
  });

  it('leaves the quote uncolored while its run is still going', async () => {
    const { reader, speakers, text } = setup(100);
    reader.update(text, true);
    const { container } = render(<MarkdownRenderer text={text} dialogue speakers={speakers} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(99); });
    expect(quote(container).dataset.speaker).toBeUndefined();
    expect(quote(container).hasAttribute('data-quote-recolor')).toBe(false);
  });

  it('stops listening when the renderer unmounts', async () => {
    const { reader, speakers, text } = setup(100);
    reader.update(text, true);
    let listening = 0;
    const subscribe = speakers.subscribe!;
    speakers.subscribe = (listener) => {
      listening++;
      const stop = subscribe(listener);
      return () => { listening--; stop(); };
    };
    const { unmount } = render(<MarkdownRenderer text={text} dialogue speakers={speakers} />);
    expect(listening).toBe(1);
    unmount();
    expect(listening).toBe(0);
  });
});
