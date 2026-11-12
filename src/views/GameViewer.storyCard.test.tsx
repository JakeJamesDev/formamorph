import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { funnelPosts } from '@/test/funnelPosts';
import { playTurn, regenerateChoices, regenerateStats, settles, stubDemoAIEndpoint } from '@/test/demoAIPlay';
import { DEMO_AI_SEEN_KEY } from '@/components/game/demoAISeen';
import { RoadSceneHost } from '@/components/road/RoadSceneHost';
import { closeRoadScene } from '@/components/road/roadSceneStore';
import { demoAITurnCount, isDemoAICardSeen, markDemoAICardSeen, recordDemoAITurn } from '@/lib/firstTimeFlowStore';
import type { PlayerStat } from '@/types';

/** The Demo AI turn count, its entry line and the Formamorph AI card on a mounted game, through the real commit path. */

// The hosted build: the Default preset is the Demo AI. Pinned so a developer's `.env.local` cannot change it.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const ENTRY_LINE = "You're on the Demo AI, a small free model. Select its badge to learn more.";

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const WORLD = harborWorld({ stats: [vigor] });

const card = () => screen.queryByTestId('story-card');
const scene = () => screen.queryByRole('dialog', { name: /Better Narration for Your Stories/ });
const box = () => screen.getByPlaceholderText(/Type your action/);

function enter() {
  return renderGameViewer(WORLD, { children: <RoadSceneHost /> });
}

/** Enters a game with the card's scene host and plays the opening. */
async function enterWithHost() {
  const view = enter();
  await screen.findByPlaceholderText(/Type your action/);
  stubDemoAIEndpoint();
  await playTurn('I step onto the dock.');
  return view;
}

/** Enters a game and plays `turns` player actions after the opening. */
async function playFromStart(turns: number) {
  const view = await enterWithHost();
  for (let turn = 1; turn <= turns; turn += 1) await playTurn(`Action ${turn}`);
  return view;
}

/** Reaches a count of `turns`: earlier games left all but the last, which this game plays. */
async function play(turns: number) {
  for (let turn = 1; turn < turns; turn += 1) recordDemoAITurn();
  const view = await enterWithHost();
  await playTurn(`Action ${turns}`);
  return view;
}

async function enterAndOpen() {
  renderGameViewer(WORLD);
  await screen.findByPlaceholderText(/Type your action/);
  stubDemoAIEndpoint();
  await playTurn('I step onto the dock.');
}

const follows = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

afterEach(() => {
  act(() => closeRoadScene());
  cleanup();
});

// Pages: jsdom has no boxes for Chat's virtualized list, so `GamePanels.chatLayout.test.tsx` and the E2E run hold Chat.
describe('the card', () => {
  it('stays away through the fourth turn, then shows on the fifth', async () => {
    await playFromStart(3);
    await playTurn('Action 4');
    expect(card()).toBeNull();
    expect(isDemoAICardSeen()).toBe(false);
    await playTurn('Action 5');
    expect(await screen.findByTestId('story-card')).toBeInTheDocument();
    expect(isDemoAICardSeen()).toBe(true);
  }, 30_000);

  it('sits under the narration and above the choices, takes no focus, and leaves play usable', async () => {
    await play(5);
    const shown = await screen.findByTestId('story-card');
    const narration = screen.getAllByText(/The ferry bell rings twice/).at(-1)!;
    const choice = screen.getAllByRole('button', { name: /Ring the bell/ }).at(-1)!;
    expect(follows(narration, shown)).toBe(true);
    expect(follows(shown, choice)).toBe(true);
    expect(shown).not.toContainElement(document.activeElement as HTMLElement);
    expect(choice).toBeEnabled();
    expect(box()).toBeEnabled();
    fireEvent.change(box(), { target: { value: 'Look around' } });
    expect(box()).toHaveValue('Look around');
  }, 30_000);

  it('stays under the latest narration through a later turn', async () => {
    await play(5);
    await screen.findByTestId('story-card');
    await playTurn('Action 6');
    expect(card()).not.toBeNull();
  }, 30_000);

  it('Not Now closes it for good: not on the next turn, and not in a later game', async () => {
    const view = await play(5);
    fireEvent.click(within(await screen.findByTestId('story-card')).getByRole('button', { name: 'Not Now' }));
    expect(card()).toBeNull();
    await playTurn('Action 6');
    expect(card()).toBeNull();
    view.unmount();

    enter();
    await screen.findByPlaceholderText(/Type your action/);
    expect(card()).toBeNull();
  }, 30_000);

  it('a reload after it shows brings nothing back, even unanswered', async () => {
    const view = await play(5);
    await screen.findByTestId('story-card');
    view.unmount();

    enter();
    await screen.findByPlaceholderText(/Type your action/);
    expect(card()).toBeNull();
  }, 30_000);

  it('See Levels opens the scene, and Keep Playing returns to the turn with the typed action and no card', async () => {
    await play(5);
    fireEvent.change(box(), { target: { value: 'Half a thought' } });
    fireEvent.click(within(await screen.findByTestId('story-card')).getByRole('button', { name: 'See Levels' }));
    expect(scene()).not.toBeNull();
    expect(funnelPosts()).toEqual(['demo_offer_shown', 'demo_see_levels']);
    fireEvent.click(screen.getByRole('button', { name: 'Keep Playing' }));
    expect(scene()).toBeNull();
    expect(card()).toBeNull();
    expect(box()).toHaveValue('Half a thought');
    expect(screen.getAllByText(/The ferry bell rings twice/).length).toBeGreaterThan(0);
  }, 30_000);
});

describe('who sees the card', () => {
  it('after Not Now, the badge dialog still opens the scene', async () => {
    await play(5);
    fireEvent.click(within(await screen.findByTestId('story-card')).getByRole('button', { name: 'Not Now' }));
    fireEvent.click(screen.getByRole('button', { name: 'Demo AI' }));
    const dialog = await screen.findByRole('dialog', { name: "You're Playing on the Demo AI" });
    fireEvent.click(within(dialog).getByRole('button', { name: 'See Levels' }));
    await waitFor(() => expect(scene()).not.toBeNull());
    expect(screen.queryByRole('dialog', { name: "You're Playing on the Demo AI" })).toBeNull();
  }, 30_000);

  it('never shows while the player reads an earlier page, and shows on the return to the latest', async () => {
    await play(4);
    await playTurn('Action 5');
    await screen.findByTestId('story-card');
    fireEvent.click(screen.getByLabelText('Go to previous page'));
    await waitFor(() => expect(card()).toBeNull());
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(await screen.findByTestId('story-card')).toBeInTheDocument();
  }, 30_000);

  it('a player on their own endpoint reaches five turns with no card', async () => {
    localStorage.setItem('FORMAMORPH_useCustomEndpoint', 'true');
    localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:9/v1/chat/completions');
    localStorage.setItem('FORMAMORPH_apiToken', 'mine');
    localStorage.setItem('FORMAMORPH_modelName', 'mine');
    await play(5);
    expect(screen.queryByRole('button', { name: 'Demo AI' })).toBeNull();
    expect(card()).toBeNull();
  }, 30_000);
});

describe('the Demo AI turn count', () => {
  it('does not count a narration regenerate, a choices re-roll or a stats re-roll', async () => {
    await enterAndOpen();
    await playTurn('I ring the bell.');
    expect(demoAITurnCount()).toBe(1);

    await settles('narration', () => fireEvent.click(screen.getByRole('button', { name: 'Regenerate Narration' })));
    expect(demoAITurnCount()).toBe(1);

    await settles('choices', () => fireEvent.click(regenerateChoices()));
    await settles('stats', () => fireEvent.click(regenerateStats()));
    expect(demoAITurnCount()).toBe(1);

    await playTurn('I wait at the dock.');
    expect(demoAITurnCount()).toBe(2);
  });

  it('stops once the card has shown', async () => {
    await enterAndOpen();
    await playTurn('I ring the bell.');
    markDemoAICardSeen();
    await playTurn('I wait at the dock.');
    expect(demoAITurnCount()).toBe(1);
  });

  it('starts at zero for a player with the seen key set, and counts from there', async () => {
    localStorage.setItem(DEMO_AI_SEEN_KEY, '1');
    await enterAndOpen();
    await playTurn('I ring the bell.');
    expect(demoAITurnCount()).toBe(1);
  });

  it('keeps the count through a rewind, and counts the new action after it', async () => {
    await enterAndOpen();
    await playTurn('I ring the bell.');
    expect(demoAITurnCount()).toBe(1);

    fireEvent.click(screen.getByLabelText('Go to previous page'));
    fireEvent.click(await screen.findByRole('button', { name: 'Rewind to Here' }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getAllByRole('button').at(-1)!);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(demoAITurnCount()).toBe(1);

    await playTurn('I wait at the dock.');
    expect(demoAITurnCount()).toBe(2);
  });
});

describe('the Demo AI entry line in the game', () => {
  it('shows with no dialog, and the input stays usable', async () => {
    renderGameViewer(WORLD);
    expect(await screen.findByText(ENTRY_LINE)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    const box = await screen.findByPlaceholderText(/Type your action/);
    expect(box).toBeEnabled();
    fireEvent.change(box, { target: { value: 'Look around' } });
    expect(box).toHaveValue('Look around');
    expect(screen.getByText(ENTRY_LINE)).not.toContainElement(document.activeElement as HTMLElement);
  });

  it('stays through the first turn with no dismissal', async () => {
    await enterAndOpen();
    expect(screen.getByText(ENTRY_LINE)).toBeInTheDocument();
  });

  it('does not show for a player with the seen key, and the badge still opens the dialog', async () => {
    localStorage.setItem(DEMO_AI_SEEN_KEY, '1');
    renderGameViewer(WORLD);
    const badge = await screen.findByRole('button', { name: 'Demo AI' });
    expect(screen.queryByText(ENTRY_LINE)).toBeNull();
    fireEvent.click(badge);
    expect(await screen.findByRole('heading', { name: "You're Playing on the Demo AI" })).toBeInTheDocument();
  });
});
