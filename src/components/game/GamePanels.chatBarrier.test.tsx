import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderMiddlePanel, stubChatLayout, type Settings, type TurnFixture } from '@/test/gamePanels';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock at Sedge Landing.', turnId: 't1', choices: ['Disembark'] },
  { action: 'I step onto the pier.', narration: 'Boards creak. A gull watches you.', turnId: 't2', choices: ['Feed the gull'] },
  { action: 'I wave at the gull.', narration: 'The gull does not wave back.', turnId: 't3', choices: ['Leave', 'Wait'] },
];

// A 1000px viewport scrolled mid-list: its reading line (300px) crosses turn 2.
const VIEWPORT = 1000;
const TURN_BOXES: Record<string, [number, number]> = { 0: [-300, 100], 1: [100, 500], 2: [500, 900] };

const chat = (settings: Settings) => settings.setNarrationLayout('chat');
// The open-at-bottom aim settles within a few frames; a player scrolls after it.
const openSettled = () => new Promise((resolve) => setTimeout(resolve, 150));

/** Give the scroller and its turns the layout jsdom lacks, then scroll it as a player would. */
function scrollToTurnTwo(scroller: HTMLElement) {
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: VIEWPORT });
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 3 * VIEWPORT });
  scroller.scrollTop = VIEWPORT;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const box = this.dataset.index !== undefined ? TURN_BOXES[this.dataset.index] : [0, VIEWPORT];
    return { top: box[0], bottom: box[1], height: box[1] - box[0], left: 0, right: 600, width: 600, x: 0, y: box[0], toJSON: () => ({}) } as DOMRect;
  });
  fireEvent.scroll(scroller);
}

describe('Chat reading-line barrier', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());
  afterEach(() => vi.restoreAllMocks());

  it('shows the turn on the reading line in the panels', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: chat });
    await screen.findAllByRole('article');
    await openSettled();
    scrollToTurnTwo(document.querySelector<HTMLElement>('[data-chat-scroller]')!);
    await waitFor(() => expect(view.gameplay().currentPage).toBe(2));
    expect(view.gameplay().isViewingPast).toBe(true);
  });

  it('submits from the latest turn while the player reads history', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: chat });
    const turns = await screen.findAllByRole('article');
    await openSettled();
    scrollToTurnTwo(document.querySelector<HTMLElement>('[data-chat-scroller]')!);
    await waitFor(() => expect(view.gameplay().isViewingPast).toBe(true));

    // The choices stay the latest turn's, under the latest narration.
    expect(within(turns[2]).getByRole('button', { name: 'Leave' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Feed the gull' })).toBeNull();

    const input = screen.getByPlaceholderText(/Type your action/) as HTMLTextAreaElement;
    expect(input.disabled).toBe(false);
    fireEvent.change(input, { target: { value: 'I follow the gull.' } });
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    expect(view.props.handleSendAction).toHaveBeenCalledTimes(1);
  });
});
