import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderMiddlePanel, stubChatLayout, turnHistory } from '@/test/gamePanels';

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const opening = turnHistory([{ action: 'START GAME', narration: 'The door opens.', turnId: 'opening' }]);

describe('Controls before the first narration', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());

  it('has no Jump to Latest before a game has narration', () => {
    const view = renderMiddlePanel({}, { settings: (s) => s.setNarrationLayout('chat') });
    expect(screen.queryByRole('button', { name: /Jump to Latest/ })).toBeNull();
    act(() => view.gameplay().setFullMessageHistory([opening[0]]));
    expect(screen.queryByRole('button', { name: /Jump to Latest/ })).toBeNull();
  });

  it.each(['pages', 'chat'] as const)('offers choice regeneration only after narration arrives in %s', async (layout) => {
    const view = renderMiddlePanel({}, { settings: (s) => {
      s.setNarrationLayout(layout);
      s.setChoicesEnabled(true);
      s.setContinueChoiceMode('off');
    } });
    const regen = () => screen.queryByRole('button', { name: 'Re-generate Choices' });
    expect(regen()).toBeNull();
    act(() => {
      view.gameplay().setFullMessageHistory([opening[0]]);
      view.gameplay().setDisplayedMessages([opening[0]]);
    });
    expect(regen()).toBeNull();
    act(() => view.gameplay().setIsWaitingForAI(true));
    expect(regen()).toBeNull();
    act(() => {
      view.gameplay().setFullMessageHistory(opening);
      view.gameplay().setDisplayedMessages(opening);
      view.gameplay().setIsRevealingNarration(true);
    });
    expect(regen()).toBeNull();
    act(() => {
      view.gameplay().setIsWaitingForAI(false);
      view.gameplay().setIsRevealingNarration(false);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Re-generate Choices' }));
    expect(view.props.handleRegenerateChoices).toHaveBeenCalledOnce();
    act(() => {
      view.gameplay().setFullMessageHistory([]);
      view.gameplay().setDisplayedMessages([]);
    });
    expect(regen()).toBeNull();
  });
});
