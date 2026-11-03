import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, regenerateChoices, regenerateStats, settles, stubDemoAIEndpoint } from '@/test/demoAIPlay';
import { DEMO_AI_SEEN_KEY } from '@/components/game/demoAISeen';
import { demoAITurnCount, markDemoAICardSeen } from '@/lib/firstTimeFlowStore';
import type { PlayerStat } from '@/types';

/** The Demo AI turn count and the entry line on a mounted game, through the real commit path. */

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

async function enterAndOpen() {
  renderGameViewer(WORLD);
  await screen.findByPlaceholderText(/Type your action/);
  stubDemoAIEndpoint();
  await playTurn('I step onto the dock.');
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

describe('the Demo AI turn count', () => {
  it('skips the opening and counts each later player action', async () => {
    await enterAndOpen();
    expect(demoAITurnCount()).toBe(0);
    await playTurn('I ring the bell.');
    expect(demoAITurnCount()).toBe(1);
    await playTurn('I wait at the dock.');
    expect(demoAITurnCount()).toBe(2);
  });

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
