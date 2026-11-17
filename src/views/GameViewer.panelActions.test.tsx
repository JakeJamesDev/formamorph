import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import type { InventoryPanelSettle } from '@/components/game/useInventoryPanel';

/** The panel actions keep their identity while choices and history stream; the inventory settle while choices do. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));
// Recorded, not replaced: the panel runs on the real hook.
const settles = vi.hoisted(() => [] as (InventoryPanelSettle | undefined)[]);
vi.mock('@/components/game/useInventoryPanel', async (original) => {
  const real = await original<typeof import('@/components/game/useInventoryPanel')>();
  return {
    ...real,
    useInventoryPanel: (...args: Parameters<typeof real.useInventoryPanel>) => {
      settles.push(args[0]);
      return real.useInventoryPanel(...args);
    },
  };
});

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const latestSettle = () => {
  const settle = settles.at(-1);
  if (!settle) throw new Error('no inventory settle yet');
  return settle;
};

describe('panel actions through a turn', () => {
  beforeEach(() => {
    settles.length = 0;
    live = null;
  });

  it('keep their identity through streamed choices and a history write, and snapshot the current state', async () => {
    renderGameViewer(harborWorld(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    const settle = latestSettle();
    const actions = settle.actions;
    if (!actions) throw new Error('no panel actions');
    const rendersBefore = settles.length;

    for (const lines of [['Wave'], ['Wave', 'Ask about the ship'], ['Wave', 'Ask about the ship', 'Leave']]) {
      act(() => { gameplay().setChoices(lines); });
    }
    expect(settles.length).toBeGreaterThan(rendersBefore);
    expect(latestSettle()).toBe(settle);

    act(() => { gameplay().setFullMessageHistory((history) => [...history, { role: 'user', content: 'Look around' }]); });
    expect(latestSettle().actions).toBe(actions);
    const { state } = actions.snapshot();
    expect(state.choices).toEqual(['Wave', 'Ask about the ship', 'Leave']);
    expect(state.fullMessageHistory?.at(-1)?.content).toBe('Look around');
  });
});
