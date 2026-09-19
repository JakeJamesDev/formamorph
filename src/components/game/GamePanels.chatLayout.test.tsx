import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { renderMiddlePanel, stubChatLayout, turnHistory, type Settings, type TurnFixture } from '@/test/gamePanels';
import { setGameplayText } from '@/lib/gameplayTextStore';

// three.js needs a WebGL context and the TTS engine a Web Audio graph; jsdom has neither.
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

const TURNS: TurnFixture[] = [
  { action: 'START GAME', narration: 'The ferry bumps the dock at Sedge Landing.', turnId: 't1' },
  { action: 'I step onto the pier.', narration: 'Boards creak. A gull watches you.', turnId: 't2', sceneTags: 'pier, gull' },
  { action: 'I wave at the gull.', narration: 'The gull does not wave back.', turnId: 't3', choices: ['Leave', 'Wait'] },
];

describe('Narration Layout: Pages', () => {
  // Recorded from the Turn Card body, so any Pages change fails here.
  it('renders the latest page unchanged', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS });
    await screen.findByText('The gull does not wave back.');
    expect(view.container).toMatchSnapshot();
  });

  it('renders a past page unchanged', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, page: 2 });
    await screen.findByText('Boards creak. A gull watches you.');
    expect(view.container).toMatchSnapshot();
  });
});

// A real 7×3 PNG, so the box can take its aspect from the header before the image decodes.
const PNG_7x3 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAADCAIAAADQoYKSAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGM4YWSEiRhIEAUAONkYnWEsh+MAAAAASUVORK5CYII=';

const chat = (settings: Settings) => settings.setNarrationLayout('chat');
const pager = () => screen.queryByRole('navigation', { name: /pagination/i });

describe('Narration Layout: Chat', () => {
  let restore: () => void;
  beforeAll(() => { restore = stubChatLayout(); });
  afterAll(() => restore());

  it('shows every turn as its action and its narration, and no Pager', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat });
    const turns = await screen.findAllByRole('article');
    expect(turns.map((t) => t.getAttribute('aria-label'))).toEqual(['Turn 1', 'Turn 2', 'Turn 3']);
    // The opening's action is the hidden start proxy, so the first turn is narration only.
    expect(within(turns[0]).queryByText('START GAME')).toBeNull();
    expect(within(turns[0]).getByText(TURNS[0].narration)).toBeTruthy();
    expect(within(turns[1]).getByText('I step onto the pier.')).toBeTruthy();
    expect(within(turns[1]).getByText(TURNS[1].narration)).toBeTruthy();
    expect(within(turns[2]).getByText('I wave at the gull.')).toBeTruthy();
    expect(pager()).toBeNull();
  });

  it('keeps the Pager in Pages, so the query above can find one', async () => {
    renderMiddlePanel({}, { turns: TURNS });
    await screen.findByText('The gull does not wave back.');
    expect(pager()).not.toBeNull();
  });

  it('shares the action input and the top-right options control with Pages', async () => {
    renderMiddlePanel({}, { turns: TURNS, settings: chat });
    await screen.findAllByRole('article');
    expect(screen.getByPlaceholderText(/Type your action/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More narration options' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
  });

  it('shows the new text when a turn is edited to narration of the same shape', async () => {
    const view = renderMiddlePanel({}, { turns: TURNS, settings: chat });
    await screen.findByText('Boards creak. A gull watches you.');
    const edited = TURNS.map((t) => (t.turnId === 't2' ? { ...t, narration: 'Boards groan. A crow watches you.' } : t));
    act(() => view.gameplay().setFullMessageHistory(turnHistory(edited)));
    expect(await screen.findByText('Boards groan. A crow watches you.')).toBeTruthy();
    expect(screen.queryByText('Boards creak. A gull watches you.')).toBeNull();
  });

  it('shows the live reveal on the latest turn only while narration streams', async () => {
    renderMiddlePanel({}, {
      turns: TURNS,
      settings: chat,
      seed: (g) => { g.setIsRevealingNarration(true); setGameplayText('The gull flaps away.'); },
    });
    const turns = await screen.findAllByRole('article');
    // The reveal wraps each word in its own span, so read the block's text.
    const latest = within(turns[2]).getByTestId('narration');
    await waitFor(() => expect(latest.textContent).toContain('The gull flaps away.'));
    expect(latest.textContent).not.toContain('The gull does not wave back.');
    expect(within(turns[1]).getByTestId('narration').textContent).toBe('Boards creak. A gull watches you.');
  });

  it('shows scene images inline in their turn, in a box sized before they load', async () => {
    renderMiddlePanel({}, {
      turns: TURNS,
      settings: chat,
      seed: (g) => g.setSceneImages({ t2: [PNG_7x3], t3: ['https://example.com/scene.png'] }),
    });
    const turns = await screen.findAllByRole('article');
    expect(within(turns[0]).queryByRole('img')).toBeNull();
    const image = await within(turns[1]).findByRole('img');
    expect(image.getAttribute('src')).toBe(PNG_7x3);
    expect(image.parentElement?.style.aspectRatio).toBe('7 / 3');
    // A linked image has no header to read, so it holds a square box.
    expect(within(turns[2]).getByRole('img').parentElement?.style.aspectRatio).toBe('1 / 1');
  });
});
