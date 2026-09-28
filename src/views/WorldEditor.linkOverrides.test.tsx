import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, openTraitFieldsTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The Traits tab's link panel: a selected link edits its own overrides, and Edit Blueprint opens the original. */

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

// Albus and Mira both link Paladin, a Blueprints original that the player cannot toggle.
const linkTo = (id: string) => ({ id, originalId: 't-paladin', kind: 'trait' as const, originalName: 'Paladin', groupId: null, order: 0 });
const WORLD: World = benchEditorWorld({
  entities: [
    { id: 'e-albus', name: 'Albus', groupId: null, order: 0, traitLinks: [linkTo('l-albus')] },
    { id: 'e-mira', name: 'Mira', groupId: null, order: 1, traitLinks: [linkTo('l-mira')] },
  ],
  traits: [{ id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'g-blueprints', order: 0 }],
  traitGroups: [{ id: 'g-blueprints', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' }],
} as Partial<World>);

/** The tree row a link draws under its bearer's node. */
const linkRow = (bearer: string) => {
  const node = screen.getAllByLabelText('Drag to reorder or nest')
    .map((grip) => grip.parentElement as HTMLElement)
    .findIndex((row) => within(row).queryByText(bearer, { exact: true }));
  return screen.getAllByLabelText('Drag to reorder or nest').map((grip) => grip.parentElement as HTMLElement)[node + 1];
};

beforeEach(() => { localStorage.clear(); });

describe('a selected link in the Traits tab', () => {
  it("writes an edit on that link only, and Reset to Blueprint in the footer drops it, in Basic too", () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Traits/);
    fireEvent.click(within(linkRow('Albus')).getByText('Paladin'));
    openTraitFieldsTab('Availability');
    fireEvent.click(screen.getByRole('checkbox', { name: /Player Can Toggle/ }));

    const [albus, mira] = ctx().entities;
    expect(albus.traitLinks![0].overrides).toEqual({ 't-paladin': { playerToggle: { value: true, blueprint: false } } });
    expect(mira.traitLinks![0]).toEqual(linkTo('l-mira'));
    expect(ctx().traits[0].playerToggle).toBeFalsy();

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Blueprint' }));
    expect(ctx().entities[0].traitLinks![0]).toEqual(linkTo('l-albus'));
    expect(screen.getByRole('button', { name: 'Reset to Blueprint' })).toBeDisabled();
  });

  it('opens the original on Edit Blueprint, where edits reach every link', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Traits/);
    fireEvent.click(within(linkRow('Mira')).getByText('Paladin'));
    expect(screen.getByText(/^Linked from/)).toHaveTextContent('Linked from Blueprints › Paladin');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Blueprint' }));
    expect(screen.queryByText(/^Linked from/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset to Blueprint' })).toBeNull();
    expect(screen.getByLabelText('Name')).toHaveTextContent('Paladin');
  });
});
