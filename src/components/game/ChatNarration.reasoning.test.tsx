import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderMiddlePanel, stubChatLayout, type Settings, type TurnFixture } from '@/test/gamePanels';
import { setGameplayText } from '@/lib/gameplayTextStore';
import { setLiveReasoning } from '@/lib/reasoningStreamStore';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock at Sedge Landing.', turnId: 't1' },
  { action: 'I step onto the pier.', narration: 'Boards creak. A gull watches you.', turnId: 't2' },
];

const chat = (settings: Settings) => settings.setNarrationLayout('chat');

describe('Chat: live reasoning', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());
  afterEach(() => setLiveReasoning({ text: '', ms: 0, active: false }));

  it('shows the live reasoning inside the latest narration bubble, above the text', async () => {
    renderMiddlePanel({}, {
      turns: TURNS,
      settings: chat,
      seed: (g) => {
        g.setIsRevealingNarration(true);
        setGameplayText('The gull flaps away.');
        setLiveReasoning({ text: 'The player wants the pier.', ms: 0, active: true });
      },
    });
    const turns = await screen.findAllByRole('article');
    const narration = within(turns[1]).getByTestId('narration');
    const bubble = narration.parentElement!;
    const reasoning = within(bubble).getByText(/The player wants the pier/);
    // Reasoning precedes the narration in document order, inside the same bubble.
    expect(reasoning.compareDocumentPosition(narration) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(turns[0]).queryByText(/The player wants the pier/)).toBeNull();
  });
});
