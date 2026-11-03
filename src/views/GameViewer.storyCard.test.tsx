import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, stubDemoAIEndpoint } from '@/test/demoAIPlay';
import { RoadSceneHost } from '@/components/road/RoadSceneHost';
import { closeRoadScene } from '@/components/road/roadSceneStore';
import { isDemoAICardSeen } from '@/lib/firstTimeFlowStore';
import type { PlayerStat } from '@/types';

/** The Formamorph AI card on a mounted game, through the real commit path. */

// The hosted build: the Default preset is the Demo AI. Pinned so a developer's `.env.local` cannot change it.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const WORLD = harborWorld({ stats: [vigor] });

const card = () => screen.queryByTestId('story-card');
const scene = () => screen.queryByRole('dialog', { name: /How Far Should Your Story Go/ });
const box = () => screen.getByPlaceholderText(/Type your action/);

function enter() {
  return renderGameViewer(WORLD, { children: <RoadSceneHost /> });
}

/** Enters a game and plays `turns` player actions after the opening. */
async function play(turns: number) {
  const view = enter();
  await screen.findByPlaceholderText(/Type your action/);
  stubDemoAIEndpoint();
  await playTurn('I step onto the dock.');
  for (let turn = 1; turn <= turns; turn += 1) await playTurn(`Action ${turn}`);
  return view;
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
    await play(3);
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
