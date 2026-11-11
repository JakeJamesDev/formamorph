import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, openTraitFieldsTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { frames } from '@/test/landing';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import type { World } from '@/types';

/** Undoing a trait's Body edit reopens the Appearance tab the edit was made on. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const WORLD: World = benchEditorWorld({
  traits: [{ id: 't-calm', name: 'Calm', statChanges: [], groupId: null, order: 0 }],
} as Partial<World>);

const step = (action: () => void | Promise<void>) => act(async () => {
  await action();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const traitStrip = () => screen.getByRole('tablist', { name: 'Trait Fields' });

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
});

describe('the trait panel after an undo', () => {
  it('opens Appearance for a Body edit made there, from another tab', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);
    fireEvent.click(screen.getAllByText('Calm', { exact: true })[0]);
    openTraitFieldsTab('Appearance');
    await step(() => { fireEvent.click(screen.getByRole('button', { name: 'Add Body' })); });
    expect(ctx().traits[0].body).toEqual({});

    openTraitFieldsTab('Details');
    expect(within(traitStrip()).getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    await step(() => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    await frames(2);

    expect(ctx().traits[0].body).toBeUndefined();
    expect(within(traitStrip()).getByRole('tab', { name: 'Appearance' })).toHaveAttribute('aria-selected', 'true');
  });
});
