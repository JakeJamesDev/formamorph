import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { renderMiddlePanel } from '@/test/gamePanels';
import { CONTINUE_CHOICE } from '@/lib/choices';
import { rowsGrew } from '@/lib/useRowReveal';
import { setRevealTiming } from '@/lib/revealTimingStore';
import { DEFAULT_DURATION, DEFAULT_STAGGER } from '@/lib/narrationRevealConfig';
import { choiceWordCount, parseStreamingChoices, splitWords } from '@/lib/choices';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const STAGGER = 50;
const LIST = ['Open fire now', 'Call out', 'Back away'];
const preview = (list: string[], settled = false) => ({ commandPreview: true, commandChoices: { list, settled } });

let now = 1000;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  setRevealTiming({ duration: STAGGER * 4, stagger: STAGGER });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setRevealTiming({ duration: DEFAULT_DURATION, stagger: DEFAULT_STAGGER });
});
const advance = (ms: number) => act(() => { now += ms; vi.advanceTimersByTime(ms); });

/** The shown rows' texts. */
const rowTexts = (testId = 'choice-rows') => {
  const root = screen.queryByTestId(testId);
  return root ? within(root).getAllByRole('button').map((b) => b.textContent) : [];
};
/** Each word's animation delay in ms in the named row, or null for a word that shows at once. */
const wordDelays = (name: string) => [...screen.getByRole('button', { name }).querySelectorAll<HTMLElement>('span[style]')]
  .filter((s) => s.style.animation)
  .map((s) => parseFloat(s.style.animation.split(' ').at(-2)!));

describe('choice rows streaming', () => {
  it('streams the first row word by word at the narration pace, and holds later rows back', () => {
    const view = renderMiddlePanel(preview([]), { turns: [] });
    act(() => view.setProps(preview(LIST)));
    expect(rowTexts()).toEqual(['Open fire now']);
    expect(wordDelays('Open fire now')).toEqual([0, STAGGER, 2 * STAGGER]);
  });

  it('starts each row a stagger after the last word of the row before', () => {
    const view = renderMiddlePanel(preview([]), { turns: [] });
    act(() => view.setProps(preview(LIST)));
    advance(2 * STAGGER + STAGGER - 1);
    expect(rowTexts()).toEqual(['Open fire now']);
    advance(1);
    expect(rowTexts()).toEqual(['Open fire now', 'Call out']);
    expect(wordDelays('Call out')).toEqual([0, STAGGER]);
    advance(2 * STAGGER);
    expect(rowTexts()).toEqual(LIST);
  });

  it('streams a row that shows late after a stall, and holds the next row back by the same amount', () => {
    const view = renderMiddlePanel(preview([]), { turns: [] });
    act(() => view.setProps(preview(LIST)));
    // The main thread is busy past the second row's start: its wake timer fires 500 ms late.
    act(() => { now += 3 * STAGGER + 500; vi.advanceTimersByTime(3 * STAGGER + 500); });
    expect(rowTexts()).toEqual(['Open fire now', 'Call out']);
    expect(wordDelays('Call out')).toEqual([0, STAGGER]);
    advance(2 * STAGGER - 1);
    expect(rowTexts()).toEqual(['Open fire now', 'Call out']);
    advance(1);
    expect(wordDelays('Back away')).toEqual([0, STAGGER]);
  });

  it('streams a row still being written as its words arrive', () => {
    const view = renderMiddlePanel(preview([]), { turns: [] });
    act(() => view.setProps(preview(['Open'])));
    advance(500);
    act(() => view.setProps(preview(['Open fire'])));
    // The word arrived after its slot, so it starts now rather than in the past.
    expect(wordDelays('Open fire')).toEqual([0, 0]);
    act(() => view.setProps(preview(['Open fire now'])));
    expect(wordDelays('Open fire now')).toEqual([0, 0, STAGGER]);
  });

  it('brings the continue choice in after the last choice', () => {
    const view = renderMiddlePanel(preview(['Go']), { turns: [], settings: (s) => s.setContinueChoiceMode('always') });
    act(() => view.setProps(preview(['Go'], true)));
    expect(rowTexts()).toEqual(['Go', CONTINUE_CHOICE]);
    expect(wordDelays(CONTINUE_CHOICE)).toEqual([0, STAGGER, 2 * STAGGER]);
    expect(wordDelays('Go')).toEqual([]);
  });

  it('shows rows present at mount, or a list that changes rather than grows, at once', () => {
    const view = renderMiddlePanel(preview(LIST), { turns: [] });
    expect(rowTexts()).toEqual(LIST);
    act(() => view.setProps(preview(['Leave', 'Stay'])));
    expect(rowTexts()).toEqual(['Leave', 'Stay']);
    expect(wordDelays('Leave')).toEqual([]);
  });

  it('shows every row at once with every reveal effect off', () => {
    const view = renderMiddlePanel(preview([]), { turns: [], settings: (s) => s.setRevealFade(false) });
    act(() => view.setProps(preview(LIST)));
    expect(rowTexts()).toEqual(LIST);
    expect(wordDelays('Open fire now')).toEqual([]);
  });

  it('streams Chat bubbles the same way', () => {
    const view = renderMiddlePanel(preview([]), { turns: [], settings: (s) => s.setNarrationLayout('chat') });
    act(() => view.setProps(preview(LIST)));
    expect(rowTexts('chat-choices')).toEqual(['Open fire now']);
    advance(3 * STAGGER);
    expect(rowTexts('chat-choices')).toEqual(['Open fire now', 'Call out']);
  });
});

describe('streamed choice replies', () => {
  it.each([
    ['numbered', '1. Walk down the hall\n2. Call into the dark\n10. Light a match'],
    ['bulleted', '- Walk down the hall\n* Call into the dark\n• Light a match'],
    ['plain', 'Walk down the hall\nCall into the dark\nWait'],
  ])('only grow the list as a %s reply arrives one character at a time, so the rows stream', (_, reply) => {
    let prev: string[] = [];
    for (let i = 1; i <= reply.length; i++) {
      const next = parseStreamingChoices(reply.slice(0, i));
      expect(rowsGrew(prev, next), `after ${JSON.stringify(reply.slice(0, i))}`).toBe(true);
      prev = next;
    }
  });
});

describe('row reveal helpers', () => {
  it('reads added rows and a last row still being written as growth', () => {
    expect(rowsGrew([], ['a'])).toBe(true);
    expect(rowsGrew(['a', 'Ca'], ['a', 'Call', 'b'])).toBe(true);
  });

  it('reads a changed earlier row or a shorter list as a new list', () => {
    expect(rowsGrew(['a', 'b'], ['x', 'b', 'c'])).toBe(false);
    expect(rowsGrew(['a', 'b'], ['a'])).toBe(false);
  });

  it('counts a choice by the words it renders, across bold and quoted runs', () => {
    expect(splitWords(' a  b ')).toEqual([' a  ', 'b ']);
    expect(choiceWordCount('Back and **seal the doors** behind')).toBe(6);
    expect(choiceWordCount('Call out "Who is there?" and wait')).toBe(7);
  });
});
