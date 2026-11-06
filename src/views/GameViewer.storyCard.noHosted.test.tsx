import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, stubDemoAIEndpoint } from '@/test/demoAIPlay';
import { HOSTED_AI_AVAILABLE } from '@/lib/hostedAi/hostedUrls';
import { demoAITurnCount, isDemoAICardSeen, recordDemoAITurn } from '@/lib/firstTimeFlowStore';
import type { PlayerStat } from '@/types';

/** A build without hosted AI, as a Steam build is: five Demo AI turns reach no offer. */

// Community accounts off, with the Default preset still on the Demo AI.
vi.hoisted(() => {
  vi.stubEnv('VITE_DEFAULT_ENDPOINT', '');
  vi.stubEnv('VITE_ENABLE_COMMUNITY', 'false');
});

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

describe('a build without hosted AI', () => {
  it('shows no card after five turns and no See Levels in the Demo AI dialog', async () => {
    expect(HOSTED_AI_AVAILABLE).toBe(false);
    // Earlier games left the count one below the threshold, and this game's turns cross it.
    for (let turn = 1; turn <= 4; turn += 1) recordDemoAITurn();
    renderGameViewer(harborWorld({ stats: [vigor] }));
    await screen.findByPlaceholderText(/Type your action/);
    stubDemoAIEndpoint();
    await playTurn('I step onto the dock.');
    await playTurn('Action 5');
    await playTurn('Action 6');
    expect(demoAITurnCount()).toBe(6);
    expect(screen.queryByTestId('story-card')).toBeNull();
    expect(isDemoAICardSeen()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Demo AI' }));
    const dialog = await screen.findByRole('dialog', { name: "You're Playing on the Demo AI" });
    expect(within(dialog).queryByRole('button', { name: 'See Levels' })).toBeNull();
  }, 30_000);
});
