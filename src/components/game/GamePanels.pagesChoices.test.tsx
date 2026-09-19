import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderMiddlePanel, type Settings, type TurnFixture } from '@/test/gamePanels';
import { CONTINUE_CHOICE } from '@/lib/choices';
import { QUOTE_CLASS } from '@/lib/quoteSegments';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock at Sedge Landing.', turnId: 't1' },
  { action: 'I step onto the pier.', narration: 'Boards creak.', turnId: 't2', choices: ['Look around', 'Go back'] },
  { action: 'Look around', narration: 'A gull watches you.', turnId: 't3', choices: ['Leave', 'Say "hello, gull"'] },
];

const input = () => screen.getByPlaceholderText(/Type your action/) as HTMLTextAreaElement;
const rows = () => within(screen.getByTestId('choice-rows'));
const row = (name: string | RegExp) => rows().getByRole('button', { name });
/** The choice rows, without the icons under them. */
const rowTexts = () => rows().getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed')).map((b) => b.textContent);
const continueAlways = (settings: Settings) => settings.setContinueChoiceMode('always');

describe('Pages: choice rows', () => {
  it('numbers the latest page choices, the continue choice last', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    await screen.findByTestId('narration');
    expect(rowTexts()).toEqual(['1.Leave', '2.Say "hello, gull"', CONTINUE_CHOICE]);
  });

  it('stages a clicked choice and appends on Ctrl+click', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    await screen.findByTestId('narration');
    fireEvent.click(row('Leave'));
    expect(input().value).toBe('Leave');
    expect(row('Leave').getAttribute('aria-pressed')).toBe('true');
    expect(row(/hello, gull/).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(row(/hello, gull/), { ctrlKey: true });
    expect(input().value).toBe('Leave. Say "hello, gull"');
  });

  it('appends a choice on a touch long press', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    await screen.findByTestId('narration');
    fireEvent.click(row('Leave'));
    vi.useFakeTimers();
    try {
      // jsdom has no PointerEvent, so a MouseEvent carries the pointer type.
      const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
      Object.defineProperty(down, 'pointerType', { value: 'touch' });
      fireEvent(row(/hello, gull/), down);
      act(() => vi.advanceTimersByTime(600));
      fireEvent.pointerUp(row(/hello, gull/));
      // The click that ends a long press does not replace the input.
      fireEvent.click(row(/hello, gull/));
    } finally {
      vi.useRealTimers();
    }
    expect(input().value).toBe('Leave. Say "hello, gull"');
  });

  it('keeps the quoted run of a choice', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    await screen.findByTestId('narration');
    expect(row(/hello, gull/).querySelector(`.${QUOTE_CLASS}`)?.textContent).toBe('"hello, gull"');
  });

  it('puts the continue choice last with no number', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: continueAlways });
    await screen.findByTestId('narration');
    expect(rowTexts()).toEqual(['1.Leave', '2.Say "hello, gull"', CONTINUE_CHOICE]);
    fireEvent.click(row(CONTINUE_CHOICE));
    expect(input().value).toBe(CONTINUE_CHOICE);
  });

  it('has no continue row with the continue choice off', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: (s) => s.setContinueChoiceMode('off') });
    await screen.findByTestId('narration');
    expect(rows().queryByRole('button', { name: CONTINUE_CHOICE })).toBeNull();
  });

  it('disables the rows on a past page and marks the taken choice', async () => {
    renderMiddlePanel({}, { turns: TURNS, page: 2 });
    await screen.findByTestId('narration');
    const taken = row('Look around');
    const other = row('Go back');
    expect(taken).toBeDisabled();
    expect(other).toBeDisabled();
    expect(taken.getAttribute('aria-pressed')).toBe('true');
    expect(other.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Re-generate Choices' })).toBeNull();
  });

  it('marks the continue row on a past page where the player continued', async () => {
    const continued = [TURNS[0], TURNS[1], { ...TURNS[2], action: CONTINUE_CHOICE }];
    renderMiddlePanel({}, { turns: continued, page: 2 });
    await screen.findByTestId('narration');
    expect(rowTexts()).toEqual(['1.Look around', '2.Go back', CONTINUE_CHOICE]);
    expect(row(CONTINUE_CHOICE)).toBeDisabled();
    expect(row(CONTINUE_CHOICE).getAttribute('aria-pressed')).toBe('true');
    expect(row('Look around').getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the old outlined buttons nowhere', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    await screen.findByTestId('narration');
    expect(screen.getAllByRole('button', { name: /Leave/ })).toHaveLength(1);
  });
});
