import { describe, it, expect, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { renderMiddlePanel } from '@/test/gamePanels';
import { CONTINUE_CHOICE } from '@/lib/choices';
import { ROW_REVEAL_DURATION, ROW_REVEAL_STAGGER, rowsGrew } from '@/lib/useRowReveal';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const LIST = ['Open fire', 'Call out', 'Back away'];
const preview = (list: string[], settled = false) => ({ commandPreview: true, commandChoices: { list, settled } });
/** Each row's animation delay in ms, or null for a row that shows at once. The box carries row one's. */
const delays = () => {
  const root = screen.getByTestId('choice-rows');
  const box = root.firstElementChild as HTMLElement;
  const rows = within(root).getAllByRole('button').map((b) => b.parentElement as HTMLElement);
  return [box, ...rows.slice(1)].map((el) => (el.style.animation ? parseFloat(el.style.animation.split(' ').at(-2)!) : null));
};
const chatDelays = () => within(screen.getByTestId('chat-choices')).getAllByRole('button')
  .map((b) => (b.style.animation ? parseFloat(b.style.animation.split(' ').at(-2)!) : null));

describe('choice rows reveal', () => {
  it('staggers rows that arrive together, with the reveal effect', () => {
    const view = renderMiddlePanel(preview([]), { turns: [] });
    act(() => view.setProps(preview(LIST)));
    expect(delays()).toEqual([0, ROW_REVEAL_STAGGER, 2 * ROW_REVEAL_STAGGER]);
    expect((screen.getByTestId('choice-rows').firstElementChild as HTMLElement).style.animation).toMatch(new RegExp(`^sd-reveal ${ROW_REVEAL_DURATION}ms`));
  });

  it('starts a streamed row on arrival once its stagger has passed, and queues one that comes sooner', () => {
    let now = 1000;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const view = renderMiddlePanel(preview([]), { turns: [] });
      act(() => view.setProps(preview(['Open fire'])));
      now += 100;
      act(() => view.setProps(preview(['Open fire', 'Call'])));
      now += 1000;
      act(() => view.setProps(preview(['Open fire', 'Call out'])));
      act(() => view.setProps(preview(LIST)));
      expect(delays()).toEqual([0, ROW_REVEAL_STAGGER - 100, 0]);
    } finally {
      clock.mockRestore();
    }
  });

  it('brings in the continue choice when the turn settles', () => {
    const view = renderMiddlePanel(preview(LIST), { turns: [], settings: (s) => s.setContinueChoiceMode('always') });
    act(() => view.setProps(preview(LIST, true)));
    expect(within(screen.getByTestId('choice-rows')).getByRole('button', { name: CONTINUE_CHOICE }).parentElement!.style.animation).toMatch(/ 0ms both$/);
    expect(delays().slice(0, 3)).toEqual([null, null, null]);
  });

  it('shows rows present at mount, or a list that changes rather than grows, at once', () => {
    const view = renderMiddlePanel(preview(LIST), { turns: [] });
    expect(delays()).toEqual([null, null, null]);
    act(() => view.setProps(preview(['Leave', 'Stay', 'Wait', 'Run'])));
    expect(delays()).toEqual([null, null, null, null]);
  });

  it('shows rows at once with every reveal effect off', () => {
    const view = renderMiddlePanel(preview([]), { turns: [], settings: (s) => s.setRevealFade(false) });
    act(() => view.setProps(preview(LIST)));
    expect(delays()).toEqual([null, null, null]);
  });

  it('staggers Chat bubbles the same way', () => {
    const view = renderMiddlePanel(preview([]), { turns: [], settings: (s) => s.setNarrationLayout('chat') });
    act(() => view.setProps(preview(LIST)));
    expect(chatDelays()).toEqual([0, ROW_REVEAL_STAGGER, 2 * ROW_REVEAL_STAGGER]);
  });
});

describe('rowsGrew', () => {
  it('reads added rows and a last row still being written as growth', () => {
    expect(rowsGrew([], ['a'])).toBe(true);
    expect(rowsGrew(['a', 'Ca'], ['a', 'Call', 'b'])).toBe(true);
  });

  it('reads a changed earlier row or a shorter list as a new list', () => {
    expect(rowsGrew(['a', 'b'], ['x', 'b', 'c'])).toBe(false);
    expect(rowsGrew(['a', 'b'], ['a'])).toBe(false);
  });
});
