import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { panelWorld } from '@/test/panelBench';
import { renderTraitsTab } from '@/test/traitsTabBench';
import type { World } from '@/types';

/** The gate marks on the Traits tree. What a requirement unlocks is the gate module's to test. */

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

const WORLD: World = panelWorld({
  entities: [
    { id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    { id: 'aldric', name: 'Sir Aldric', persona: true, playerDescription: 'A knight.', aiDescription: 'A knight.', locations: ['harbor'] },
  ],
  traitGroups: [{ id: 'g-class', name: 'Class', parentId: null, maxPicks: 1 }],
  traits: [
    { id: 't-paladin', name: 'Paladin', groupId: 'g-class', statChanges: [] },
    { id: 't-rogue', name: 'Rogue', groupId: 'g-class', statChanges: [] },
    { id: 't-plate', name: 'Plate Armor', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 't-paladin' }] }] },
    { id: 't-loose', name: 'Lamp-Lit', statChanges: [] },
    { id: 't-mark', name: 'Guild Mark', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 'gone', name: 'Thief' }] }] },
  ],
} as Partial<World>);

/** The tree row that draws `name`, found by its drag grip so the panel's own copy of the name never matches. */
const treeRow = (name: string) => screen.getAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name)) as HTMLElement;

const traitRequires = (ctx: () => { traits: World['traits'] }, id: string) => ctx().traits.find((t) => t.id === id)?.requires;

beforeEach(() => { localStorage.clear(); });

describe('gate marks on the Traits tree', () => {
  it('marks a gated row with a lock and its count, with the full rule as the tip', async () => {
    renderTraitsTab(WORLD, 'advanced');
    const row = treeRow('Plate Armor');
    expect(row).toHaveTextContent(/Plate Armor1$/);
    expect(row.querySelector('.lucide-lock')).not.toBeNull();
    expect(treeRow('Lamp-Lit').querySelector('.lucide-lock')).toBeNull();
    act(() => { (within(row).getByText('1').closest('[tabindex]') as HTMLElement).focus(); });
    expect(await screen.findByText('Requires Paladin')).toBeInTheDocument();
  });

  it('tints a row red when a requirement points at nothing', () => {
    renderTraitsTab(WORLD, 'advanced');
    expect(within(treeRow('Guild Mark')).getByText('Guild Mark').closest('.text-destructive')).not.toBeNull();
    expect(within(treeRow('Plate Armor')).getByText('Plate Armor').closest('.text-destructive')).toBeNull();
  });

  it('leaves a dependent locked, never open, when its target is deleted', () => {
    const { ctx } = renderTraitsTab(WORLD, 'advanced');
    act(() => { ctx().removeTrait('t-paladin'); });
    expect(traitRequires(ctx, 't-plate')).toEqual([{ all: [{ kind: 'trait', id: 't-paladin' }] }]);
    const row = treeRow('Plate Armor');
    expect(row.querySelector('.lucide-lock')).not.toBeNull();
    expect(within(row).getByText('Plate Armor').closest('.text-destructive')).not.toBeNull();
  });
});
