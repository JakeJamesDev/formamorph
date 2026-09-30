import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { World } from '@/types';

/** The Placeholders tab's Blueprints group and the copies entities hold of its blueprints. */

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

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `p-${id}` });

const BARE: World = benchEditorWorld({
  placeholders: [{ id: 'eyes', name: 'Eyes', values: [{ id: 'v-amber', text: 'amber' }] }],
} as Partial<World>);

const WITH_COPY: World = benchEditorWorld({
  placeholders: [
    { id: 'garb', name: 'Class Garb', groupId: 'bp', values: [{ id: 'v-tabard', text: 'a tabard' }, { id: 'v-plate', text: 'plate' }] },
  ],
  placeholderGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' }],
  traitGroups: [{ id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  traits: [{ id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'tbp', aiDescription: `Wears ${chip('garb')}.` }],
  // Albus links Paladin, whose text places the blueprint, so the store keeps his copy in use.
  entities: [{
    id: 'e-albus', name: 'Albus',
    traitLinks: [{ id: 'l-paladin', originalId: 't-paladin', kind: 'trait', originalName: 'Paladin', groupId: null }],
    placeholders: [{ id: 'c-garb', name: 'Class Garb', values: [], blueprintId: 'garb' }],
  }],
} as Partial<World>);

/** A tree row found by its drag grip, so the panel's own copy of the name never matches. */
const treeRow = (name: string) => screen.queryAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name));

const openAddMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Add to Placeholders' }));

beforeEach(() => { localStorage.clear(); });

describe('the Placeholders tab Blueprints group', () => {
  it('adds one Blueprints group at the top level from the + menu, then stops offering it', () => {
    const { ctx } = renderWorldEditorBench(BARE, 'advanced');
    openEditorTab(/Placeholders/);
    openAddMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Add Blueprints Group' }));
    expect(ctx().placeholderGroups).toEqual([expect.objectContaining({ name: 'Blueprints', parentId: null, system: 'blueprints' })]);
    expect(screen.getByLabelText('Group Name')).toBeDisabled();
    expect(screen.getByText(/Each entity reads a blueprint through its own copy/)).toBeInTheDocument();
    expect(treeRow('Blueprints')).toBeDefined();
    openAddMenu();
    expect(screen.queryByRole('button', { name: 'Add Blueprints Group' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Group' })).toBeInTheDocument();
  });

  it('keeps the group while trait text and copies use its blueprints, naming the uses', () => {
    const { ctx } = renderWorldEditorBench(WITH_COPY, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(within(treeRow('Blueprints')!).getByRole('button', { name: 'Remove Blueprints' }));
    const notice = screen.getAllByRole('status').find((el) => el.textContent?.includes('Blueprints stays'))!;
    expect(notice).toHaveTextContent('Blueprints stays, because Trait: Paladin and Copy: Albus.Class Garb use its blueprints.');
    expect(ctx().placeholderGroups.map((g) => g.id)).toEqual(['bp']);
    fireEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Blueprints stays/)).toBeNull();
  });

  it('removes an unused group, its placeholders going to the top level', () => {
    const { ctx } = renderWorldEditorBench({ ...WITH_COPY, traits: [], entities: [] }, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(within(treeRow('Blueprints')!).getByRole('button', { name: 'Remove Blueprints' }));
    expect(ctx().placeholderGroups).toEqual([]);
    expect(ctx().placeholders[0]).not.toHaveProperty('groupId');
  });
});

describe('a copy on the Placeholders tab', () => {
  it("reads as the owner's copy under the blueprint's live name, with no Duplicate", () => {
    const { ctx } = renderWorldEditorBench(WITH_COPY, 'advanced');
    openEditorTab(/Placeholders/);
    const row = treeRow('Albus.Class Garb')!;
    expect(row).toBeDefined();
    expect(within(row).queryByRole('button', { name: 'Duplicate' })).toBeNull();
    fireEvent.click(within(treeRow('Class Garb')!).getByText('Class Garb'));
    fireEvent.change(screen.getByDisplayValue('Class Garb'), { target: { value: 'Garb' } });
    expect(ctx().placeholders[0].name).toBe('Garb');
    expect(treeRow('Albus.Garb')).toBeDefined();
  });

  it('opens the copy editor, and Edit Blueprint opens the blueprint', () => {
    renderWorldEditorBench(WITH_COPY, 'advanced');
    openEditorTab(/Placeholders/);
    fireEvent.click(within(treeRow('Albus.Class Garb')!).getByText('Albus.Class Garb'));
    expect(screen.getByLabelText('Name')).toHaveValue('Albus.Class Garb');
    expect(screen.getByRole('button', { name: 'Reset to Blueprint' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Blueprint' }));
    expect(screen.getByDisplayValue('Class Garb')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to Blueprint' })).toBeNull();
  });
});
