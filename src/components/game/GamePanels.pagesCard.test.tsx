import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderMiddlePanel, statFixture, stubChatLayout, type Settings, type TurnFixture } from '@/test/gamePanels';
import { QUOTE_CLASS } from '@/lib/quoteSegments';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock at Sedge Landing.', turnId: 't1' },
  { action: 'I step onto the pier.', narration: 'Boards creak. A **gull** watches you.', turnId: 't2', choices: ['Look around'] },
  { action: 'I say *softly* "hello, gull."', narration: 'The gull does not wave back.', turnId: 't3', choices: ['Leave', 'Wait'] },
];
const STATS = [statFixture('Health', 50)];

const statsOn = (settings: Settings) => settings.setStatUpdatesEnabled(true);
const chat = (settings: Settings) => { statsOn(settings); settings.setNarrationLayout('chat'); };

const rowNames = (row: HTMLElement) => within(row).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? '');
const rightClick = (el: HTMLElement) => fireEvent.contextMenu(el, { button: 2, clientX: 10, clientY: 10 });
/** The labels of the menu a right-click on `el` opens, then closes it. */
async function menuLabels(el: HTMLElement) {
  rightClick(el);
  const labels = within(screen.getByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent);
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  return labels;
}

/** The row and menu labels of 1-based `turn` in Pages, viewed on its own page. */
async function pagesActions(turn: number) {
  renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS, stats: STATS, page: turn, settings: statsOn });
  const narration = await screen.findByTestId('narration');
  const result = { row: rowNames(screen.getByTestId('bubble-actions')), menu: await menuLabels(narration) };
  cleanup();
  return result;
}

/** The row and menu labels of 1-based `turn` in Chat. */
async function chatActions(turn: number) {
  renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS, stats: STATS, settings: chat });
  const article = (await screen.findAllByRole('article'))[turn - 1];
  const result = {
    row: rowNames(within(article).getByTestId('bubble-actions')),
    menu: await menuLabels(within(article).getByTestId('narration')),
  };
  cleanup();
  return result;
}

describe('Narration layout parity', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());

  it.each([['the latest turn', 3], ['a past turn', 2]])('lists the same actions for %s in Pages and in Chat', async (_, turn) => {
    const pages = await pagesActions(turn);
    const chatted = await chatActions(turn);
    expect(pages.row).toEqual(chatted.row);
    expect(pages.menu).toEqual(chatted.menu);
    expect(pages.row).not.toContain('Generate Scene Image');
    expect(pages.row).not.toContain('Re-generate Stats');
    expect(pages.menu).toContain('Generate Scene Image');
    // The menu lists the row's icons and the items behind its More icon.
    expect(pages.row.length).toBeGreaterThan(1);
    expect(pages.menu).toEqual(expect.arrayContaining(pages.row.filter((n) => n !== 'More')));
  });

  it.each([['the latest turn', 3], ['a past turn', 2]])('lists the same player-action menu for %s in Pages and in Chat', async (_, turn) => {
    renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS, stats: STATS, page: turn, settings: statsOn });
    const pages = await menuLabels(await screen.findByTestId('action-line'));
    cleanup();
    renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS, stats: STATS, settings: chat });
    const article = (await screen.findAllByRole('article'))[turn - 1];
    const chatted = await menuLabels(within(article).getByTestId('player-action'));
    cleanup();
    expect(pages).toEqual(chatted);
    expect(pages.length).toBeGreaterThan(0);
  });
});

describe('Pages: the action line menu', () => {
  afterEach(() => { window.getSelection()?.removeAllRanges(); });

  it("lists the player action's Edit and Copy Text, not the narration's actions", async () => {
    renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS, stats: STATS, settings: statsOn });
    expect(await menuLabels(await screen.findByTestId('action-line'))).toEqual(['Edit', 'Copy Text']);
  });

  it("copies the action's markdown source", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const real = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      renderMiddlePanel({}, { turns: TURNS });
      rightClick(await screen.findByTestId('action-line'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Text' }));
      expect(writeText).toHaveBeenCalledWith('I say *softly* "hello, gull."');
    } finally {
      if (real) Object.defineProperty(navigator, 'clipboard', real);
      else delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it('disables Edit while a turn generates', async () => {
    renderMiddlePanel({}, { turns: TURNS, page: 2, seed: (g) => g.setIsWaitingForAI(true) });
    rightClick(await screen.findByTestId('action-line'));
    expect(screen.getByRole('menuitem', { name: 'Edit' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('menuitem', { name: 'Copy Text' }).getAttribute('aria-disabled')).toBeNull();
  });

  it('keeps the browser menu on the action line while the narration streams', async () => {
    renderMiddlePanel({}, { turns: TURNS, gameplayText: 'The gull', seed: (g) => g.setIsRevealingNarration(true) });
    expect(rightClick(await screen.findByTestId('action-line'))).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps the browser menu for a right-click on selected action text', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    const text = within(await screen.findByTestId('action-line')).getByText('softly');
    window.getSelection()!.selectAllChildren(text);
    expect(rightClick(text)).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Pages: the Turn Card', () => {
  afterEach(() => { window.getSelection()?.removeAllRanges(); });

  it('shows the action line and the narration with no You: or Event: labels', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    await screen.findByTestId('narration');
    expect(screen.queryByText(/^You:/)).toBeNull();
    expect(screen.queryByText(/^Event:/)).toBeNull();
    expect(screen.getByTestId('action-line').textContent).toContain('hello, gull.');
  });

  it('keeps the italics and the quote style of the player action on an upright line', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    const line = await screen.findByTestId('action-line');
    expect(within(line).getByText('softly').closest('em')).not.toBeNull();
    expect(line.querySelector(`.${QUOTE_CLASS}`)?.textContent).toContain('hello, gull.');
    expect(line.className).not.toMatch(/\bitalic\b/);
  });

  it('shows no action line on the opening page', async () => {
    renderMiddlePanel({}, { turns: TURNS, page: 1 });
    await screen.findByTestId('narration');
    expect(screen.queryByTestId('action-line')).toBeNull();
    expect(screen.queryByText('START GAME')).toBeNull();
  });

  it('has no pencil, Re-generate, or Rollback button, and the corner menu holds Export Story only', async () => {
    for (const page of [2, 3]) {
      renderMiddlePanel({ ttsLoaded: true }, { turns: TURNS, stats: STATS, page, settings: statsOn });
      await screen.findByTestId('narration');
      expect(screen.queryByRole('button', { name: 'Edit text' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Re-generate' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'More re-generate options' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Rollback/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'More narration options' }));
      const menu = await screen.findByRole('dialog');
      expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual(['Export Story']);
      cleanup();
    }
  });

  it('confirms Rewind to Here on a past page, then rolls back to that page', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, page: 2 });
    fireEvent.click(within(await screen.findByTestId('bubble-actions')).getByRole('button', { name: 'Rewind to Here' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(view.props.handleRollback).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(view.props.handleRollback).toHaveBeenCalledWith(2);
  });

  it('re-generates the latest narration through its row and stats through its menu', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, stats: STATS, settings: statsOn });
    const row = await screen.findByTestId('bubble-actions');
    fireEvent.click(within(row).getByRole('button', { name: 'Re-generate Narration' }));
    fireEvent.click(within(row).getByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Re-generate Stats' }));
    expect(view.props.handleRegenerate).toHaveBeenCalledWith(3);
    expect(view.props.handleRegenerateStats).toHaveBeenCalledWith(3);
  });

  it('shows no action row while the narration streams', async () => {
    renderMiddlePanel({}, { turns: TURNS, gameplayText: 'The gull', seed: (g) => g.setIsRevealingNarration(true) });
    await screen.findByTestId('narration');
    expect(screen.queryByTestId('bubble-actions')).toBeNull();
    expect(rightClick(screen.getByTestId('narration'))).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disables the actions that start a request while a turn generates', async () => {
    renderMiddlePanel({}, { turns: TURNS, stats: STATS, settings: statsOn, seed: (g) => g.setIsWaitingForAI(true) });
    const row = await screen.findByTestId('bubble-actions');
    expect(within(row).getByRole('button', { name: 'Re-generate Narration' })).toBeDisabled();
    expect(within(row).getByRole('button', { name: 'Copy Text' })).toBeEnabled();
    fireEvent.click(within(row).getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Re-generate Stats' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('offers Re-generate Choices on the latest page only', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS });
    await screen.findByTestId('narration');
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Choices' }));
    expect(view.props.handleRegenerateChoices).toHaveBeenCalledTimes(1);
    cleanup();
    renderMiddlePanel({}, { turns: TURNS, page: 2 });
    await screen.findByTestId('narration');
    expect(screen.queryByRole('button', { name: 'Re-generate Choices' })).toBeNull();
  });

  it('edits the viewed page from the row', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, page: 2 });
    fireEvent.click(within(await screen.findByTestId('bubble-actions')).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Boards creak. A **gull** watches you.');
    expect(view.props.handleRollback).not.toHaveBeenCalled();
  });

  it('keeps the browser menu for a right-click on selected text', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    const text = within(await screen.findByTestId('narration')).getByText(/The gull does not/);
    window.getSelection()!.selectAllChildren(text);
    expect(rightClick(text)).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
