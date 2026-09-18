import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderMiddlePanel, stubChatLayout, type Settings, type TurnFixture } from '@/test/gamePanels';
import { CONTINUE_CHOICE } from '@/lib/choices';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock at Sedge Landing.', turnId: 't1', choices: ['Disembark'] },
  { action: 'I step onto the pier.', narration: 'Boards creak. A gull watches you.', turnId: 't2', choices: ['Feed the gull'] },
  { action: 'I wave at the gull.', narration: 'The gull does not wave back.', turnId: 't3', choices: ['Leave', 'Wait'] },
];

const chat = (settings: Settings) => settings.setNarrationLayout('chat');
const input = () => screen.getByPlaceholderText(/Type your action/) as HTMLTextAreaElement;

describe('Chat choices', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());

  it('shows the choices under the latest narration only', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat });
    const turns = await screen.findAllByRole('article');
    const latest = within(turns[2]).getByTestId('chat-choices');
    expect(within(latest).getByRole('button', { name: 'Leave' })).toBeTruthy();
    expect(within(latest).getByRole('button', { name: 'Wait' })).toBeTruthy();
    expect(within(turns[0]).queryByTestId('chat-choices')).toBeNull();
    expect(within(turns[1]).queryByTestId('chat-choices')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Feed the gull' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Disembark' })).toBeNull();
  });

  it('puts a clicked choice in the action input and fills its bubble', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat });
    const leave = await screen.findByRole('button', { name: 'Leave' });
    fireEvent.click(leave);
    expect(input().value).toBe('Leave');
    expect(leave.hasAttribute('data-selected')).toBe(true);
    expect(screen.getByRole('button', { name: 'Wait' }).hasAttribute('data-selected')).toBe(false);
    // Ctrl+click appends as a new sentence.
    fireEvent.click(screen.getByRole('button', { name: 'Wait' }), { ctrlKey: true });
    expect(input().value).toBe('Leave. Wait');
  });

  it('shows Continue the Story as a choice bubble', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: (s) => { chat(s); s.setContinueChoiceMode('always'); } });
    const turns = await screen.findAllByRole('article');
    const block = within(turns[2]).getByTestId('chat-choices');
    const bubble = within(block).getByRole('button', { name: CONTINUE_CHOICE });
    expect(bubble.className).toBe(within(block).getByRole('button', { name: 'Leave' }).className);
  });

  it('disables the choices while a reply streams', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat, seed: (g) => g.setIsWaitingForAI(true) });
    const leave = await screen.findByRole('button', { name: 'Leave' });
    expect((leave as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(leave);
    expect(input().value).toBe('');
    expect((screen.getByRole('button', { name: 'Re-generate Choices' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls the re-generate handler from the icon under the choices', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: chat });
    const turns = await screen.findAllByRole('article');
    fireEvent.click(within(turns[2]).getByRole('button', { name: 'Re-generate Choices' }));
    expect(view.props.handleRegenerateChoices).toHaveBeenCalledTimes(1);
  });

  it('appends a choice on a touch long press and opens no menu', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat });
    const leave = await screen.findByRole('button', { name: 'Leave' });
    fireEvent.click(screen.getByRole('button', { name: 'Wait' }));
    vi.useFakeTimers();
    try {
      // jsdom has no PointerEvent, so a MouseEvent carries the pointer type.
      const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
      Object.defineProperty(down, 'pointerType', { value: 'touch' });
      fireEvent(leave, down);
      // Past both the append press and the menu's own long press.
      act(() => vi.advanceTimersByTime(1000));
      // Android follows a long press with a contextmenu event.
      fireEvent.contextMenu(leave);
    } finally {
      vi.useRealTimers();
    }
    expect(input().value).toBe('Wait. Leave');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens no choices menu while a reply streams', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat, seed: (g) => g.setIsWaitingForAI(true) });
    const turns = await screen.findAllByRole('article');
    fireEvent.contextMenu(within(turns[2]).getByTestId('chat-choices'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('has no re-generate icon with the choices request off', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: (s) => { chat(s); s.setChoicesEnabled(false); } });
    await screen.findAllByRole('article');
    expect(screen.queryByRole('button', { name: 'Re-generate Choices' })).toBeNull();
  });
});
