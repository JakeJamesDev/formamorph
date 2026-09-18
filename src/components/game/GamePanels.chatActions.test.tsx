import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readTurn, renderMiddlePanel, statFixture, stubChatLayout, type Settings, type TurnFixture } from '@/test/gamePanels';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock at Sedge Landing.', turnId: 't1', summary: 'Arrived.' },
  { action: 'I step onto the pier.', narration: 'Boards creak. A **gull** watches you.', turnId: 't2', summary: 'On the pier.' },
  { action: 'I wave at the gull.', narration: 'The gull does not wave back.', turnId: 't3', summary: 'Snubbed.' },
];
const STATS = [statFixture('Health', 50)];

const chat = (settings: Settings) => {
  settings.setNarrationLayout('chat');
  settings.setStatUpdatesEnabled(true);
};

/** The action row of the bubble for 1-based `turn`. */
async function row(turn: number) {
  const turns = await screen.findAllByRole('article');
  return within(turns[turn - 1]).getByTestId('bubble-actions');
}
const names = (el: HTMLElement) => within(el).getAllByRole('button').map((b) => b.getAttribute('aria-label'));

describe('Chat bubble actions', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());

  it('gives the latest bubble the re-generate actions and a past bubble Rewind to Here', async () => {
    renderMiddlePanel({}, { turns: TURNS, stats: STATS, settings: chat });
    expect(names(await row(3))).toEqual([
      'Re-generate Narration', 'Re-generate Stats', 'Generate Scene Image', 'Edit', 'Text to Speech', 'Copy Text', 'More',
    ]);
    expect(names(await row(2))).toEqual(['Generate Scene Image', 'Edit', 'Copy Text', 'Rewind to Here', 'More']);
  });

  it('shows each turn number on its row', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat });
    expect((await row(2)).textContent).toContain('Turn 2');
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Turn 1', 'Turn 2', 'Turn 3']);
  });

  it('re-generates the latest turn, not the viewed one', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, stats: STATS, settings: chat, page: 1 });
    const latest = await row(3);
    fireEvent.click(within(latest).getByRole('button', { name: 'Re-generate Narration' }));
    fireEvent.click(within(latest).getByRole('button', { name: 'Re-generate Stats' }));
    expect(view.props.handleRegenerate).toHaveBeenCalledWith(3);
    expect(view.props.handleRegenerateStats).toHaveBeenCalledWith(3);
  });

  it('confirms Rewind to Here, then rolls back to its own turn', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: chat, page: 2 });
    fireEvent.click(within(await row(1)).getByRole('button', { name: 'Rewind to Here' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(view.props.handleRollback).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(view.props.handleRollback).toHaveBeenCalledTimes(1);
    expect(view.props.handleRollback).toHaveBeenCalledWith(1);
  });

  it('does not roll back when Rewind to Here is canceled', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: chat });
    fireEvent.click(within(await row(2)).getByRole('button', { name: 'Rewind to Here' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(view.props.handleRollback).not.toHaveBeenCalled();
  });

  it('runs the scene and audio actions for the bubble\'s own turn', async () => {
    const view = renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS, settings: chat, page: 3 });
    const past = await row(2);
    fireEvent.click(within(past).getByRole('button', { name: 'Generate Scene Image' }));
    expect(view.props.onSceneImage).toHaveBeenCalledWith(undefined, 2);
    fireEvent.click(within(await row(3)).getByRole('button', { name: 'Text to Speech' }));
    expect(view.props.onTTSClick).toHaveBeenCalledTimes(1);

    fireEvent.click(within(past).getByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Write Scene Tags' }));
    expect(view.props.onSceneTags).toHaveBeenCalledWith(2);

    fireEvent.click(within(past).getByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate Audio' }));
    expect(view.props.onRegenerateTTS).toHaveBeenCalledWith('Boards creak. A **gull** watches you.');
  });

  it('copies the turn\'s markdown source', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const real = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      renderMiddlePanel({}, { turns: TURNS, settings: chat });
      fireEvent.click(within(await row(2)).getByRole('button', { name: 'Copy Text' }));
      expect(writeText).toHaveBeenCalledWith('Boards creak. A **gull** watches you.');
    } finally {
      if (real) Object.defineProperty(navigator, 'clipboard', real);
      else delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it('edits the bubble\'s own turn, not the viewed one', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: chat, page: 3 });
    fireEvent.click(within(await row(1)).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('The ferry bumps the dock at Sedge Landing.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    // A saved edit drops the edited turn's memory digest and no other.
    const history = view.gameplay().fullMessageHistory;
    expect(readTurn(history, 1).summary).toBeUndefined();
    expect(readTurn(history, 3).summary).toBe('Snubbed.');
    // The viewed page's messages keep their own narration.
    expect(view.gameplay().displayedMessages[1].content).toContain('The gull does not wave back.');
  });

  it('disables the actions that start a request while a reply streams', async () => {
    renderMiddlePanel({}, { turns: TURNS, stats: STATS, settings: chat, seed: (g) => g.setIsWaitingForAI(true) });
    const disabled = (el: HTMLElement, name: string) => (within(el).getByRole('button', { name }) as HTMLButtonElement).disabled;
    const latest = await row(3);
    expect(disabled(latest, 'Re-generate Narration')).toBe(true);
    expect(disabled(latest, 'Re-generate Stats')).toBe(true);
    expect(disabled(latest, 'Copy Text')).toBe(false);
    expect(disabled(await row(1), 'Rewind to Here')).toBe(true);
  });

  it('gives a live turn no actions', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat, gameplayText: 'The gull', seed: (g) => g.setIsRevealingNarration(true) });
    const turns = await screen.findAllByRole('article');
    expect(within(turns[2]).queryByTestId('bubble-actions')).toBeNull();
    expect(within(turns[1]).getByTestId('bubble-actions')).toBeTruthy();
  });

  it('keeps only the whole-story items in the top-right control', async () => {
    renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS, settings: chat });
    await screen.findAllByRole('article');
    expect(screen.queryByRole('button', { name: 'Edit text' })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'More narration options' })); });
    const menu = await screen.findByRole('dialog');
    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual(['Export Story']);
  });

  it('keeps the full control and no bubble rows in Pages', async () => {
    renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS });
    await screen.findByTestId('narration');
    expect(screen.queryByTestId('bubble-actions')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More narration options' }));
    const menu = await screen.findByRole('dialog');
    expect(within(menu).getByRole('button', { name: /Write Scene Tags/ })).toBeTruthy();
    expect(within(menu).getByRole('button', { name: /Export Story/ })).toBeTruthy();
  });
});
