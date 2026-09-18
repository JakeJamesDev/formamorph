import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderMiddlePanel, stubChatLayout, type Settings, type TurnFixture } from '@/test/gamePanels';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

// A menu row that opens a Dialog hangs jsdom; the edit and its save run in e2e/chat-edit-action.spec.ts.
const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock at Sedge Landing.', turnId: 't1' },
  { action: 'I step onto the pier.', narration: 'Boards creak. A gull watches you.', turnId: 't2' },
  { action: 'I wave at the gull.', narration: 'The gull does not wave back.', turnId: 't3' },
];

const chat = (settings: Settings) => settings.setNarrationLayout('chat');

async function actionBubble(turn: number) {
  const turns = await screen.findAllByRole('article');
  return within(turns[turn - 1]).queryByTestId('player-action');
}
const rightClick = (el: HTMLElement) => fireEvent.contextMenu(el, { button: 2, clientX: 10, clientY: 10 });

describe('Chat action bubble Edit', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());

  it('gives the first turn no action bubble, so it offers no Edit', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat });
    expect(await actionBubble(1)).toBeNull();
    expect(await actionBubble(2)).not.toBeNull();
  });

  it('disables Edit while a reply streams', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat, seed: (g) => g.setIsWaitingForAI(true) });
    rightClick((await actionBubble(2))!);
    expect(screen.getByRole('menuitem', { name: 'Edit' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('menuitem', { name: 'Copy Text' }).getAttribute('aria-disabled')).toBeNull();
  });
});
