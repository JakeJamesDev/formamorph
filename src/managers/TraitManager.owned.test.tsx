import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { panelWorld, openTraitFieldsTab } from '@/test/panelBench';
import { renderTraitsTab } from '@/test/traitsTabBench';
import type { World } from '@/types';

/** An owned trait's panel, and requirements across owners. */

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
    { id: 'wick', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    {
      id: 'ash', name: 'Ash', persona: true, playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
      traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, maxPicks: 2 }],
      traits: [
        { id: 't-tamed', name: 'Tamed', groupId: 'g-bond', statChanges: [] },
        { id: 't-wild', name: 'Wild', groupId: 'g-bond', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 't-paladin' }] }] },
      ],
    },
  ],
  traits: [
    { id: 't-paladin', name: 'Paladin', statChanges: [] },
    { id: 't-tamer', name: 'Beast Tamer', statChanges: [] },
  ],
} as Partial<World>);

/** A tree row found by its drag grip, so the panel's own copy of the name never matches. */
const treeRow = (name: string) => screen.getAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name));

const entity = (ctx: () => { entities: World['entities'] }, id: string) => ctx().entities.find((e) => e.id === id)!;

beforeEach(() => { localStorage.clear(); });

describe('an owned trait\'s panel', () => {

  it("picks a cast entity's own stats on its trait's Stats tab, and the global stats too, played or not (Q18)", async () => {
    const withStats = (persona: boolean, statId: string) => ({
      ...WORLD,
      stats: [{ id: 'hp', name: 'Health', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] }],
      entities: WORLD.entities.map((e) => (e.id === 'ash'
        ? {
          ...e, persona, stats: [{ id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] }],
          traits: e.traits!.map((t) => (t.id === 't-tamed' ? { ...t, statChanges: [{ statId, value: 5, type: 'max' }] } : t)),
        }
        : e)),
    }) as World;
    const statsTab = () => {
      fireEvent.click(treeRow('Tamed')!);
      const strip = screen.getByRole('tablist', { name: 'Trait Fields' });
      expect(within(strip).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Availability', 'Stats', 'Appearance', 'Pins', 'Scripts']);
      fireEvent.mouseDown(within(strip).getByRole('tab', { name: 'Stats' }));
    };
    const { unmount } = renderTraitsTab(withStats(false, 'vigor'), 'advanced');
    statsTab();
    expect(screen.getByText('Vigor')).toBeInTheDocument();
    unmount();

    // A cast entity nobody plays is offered the Global stats under their own heading, and its row reads one.
    renderTraitsTab(withStats(false, 'hp'), 'advanced');
    statsTab();
    const trigger = screen.getAllByRole('combobox').find((c) => /Health/.test(c.textContent ?? ''))!;
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
    expect(await screen.findByText('Global')).toBeInTheDocument();
    const options = await screen.findAllByRole('option', { hidden: true });
    expect(options.map((o) => o.textContent)).toEqual(['Vigor', 'Health']);
  });

  it("tells an entity's own stat from a global stat with its id (Q58)", async () => {
    const health = { id: 'hp', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] };
    const world = {
      ...WORLD,
      stats: [{ ...health, name: 'Health' }],
      traits: WORLD.traits.map((t) => (t.id === 't-paladin' ? { ...t, statToggles: [{ statId: 'hp', enabled: true }] } : t)),
      entities: WORLD.entities.map((e) => (e.id === 'ash'
        ? {
          ...e, stats: [{ ...health, name: 'Ash Health' }],
          traits: e.traits!.map((t) => (t.id === 't-tamed'
            ? { ...t, statChanges: [{ statId: 'hp', value: 5, type: 'max' }], statToggles: [{ statId: 'hp', enabled: false }] }
            : t)),
        }
        : e)),
    } as World;
    const { ctx } = renderTraitsTab(world, 'advanced');
    fireEvent.click(treeRow('Tamed')!);
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Trait Fields' })).getByRole('tab', { name: 'Stats' }));
    expect(screen.queryByText(/stat changes apply/i)).toBeNull();
    expect(screen.queryByText(/Also set by/)).toBeNull();

    const choose = async (trigger: HTMLElement, name: string) => {
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
      await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
      const options = await screen.findAllByRole('option', { hidden: true });
      expect(options.map((o) => o.textContent)).toEqual(['Ash Health', 'Health']);
      fireEvent.keyDown(options.find((o) => o.textContent === name)!, { key: 'Enter' });
    };
    const statPickers = () => screen.getAllByRole('combobox').filter((c) => /Health|Select stat/.test(c.textContent ?? ''));
    expect(statPickers().map((c) => c.textContent)).toEqual(['Ash Health', 'Ash Health']);

    await choose(statPickers()[0], 'Health');
    expect(entity(ctx, 'ash').traits!.find((t) => t.id === 't-tamed')!.statChanges)
      .toEqual([{ statId: 'hp', value: 5, type: 'max', target: 'global' }]);

    await choose(statPickers()[1], 'Health');
    expect(entity(ctx, 'ash').traits!.find((t) => t.id === 't-tamed')!.statToggles).toEqual([{ statId: 'hp', enabled: false, target: 'global' }]);
    expect(screen.getByText(/Also set by/)).toBeInTheDocument();

    await choose(statPickers()[0], 'Ash Health');
    expect(entity(ctx, 'ash').traits!.find((t) => t.id === 't-tamed')!.statChanges).toEqual([{ statId: 'hp', value: 5, type: 'max' }]);
  });

  it("picks a stat the entity links from Blueprints as its own", () => {
    const world = {
      ...WORLD,
      stats: [{ id: 'bp-trust', name: 'Trust', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], groupId: 'sbp' }],
      statGroups: [{ id: 'sbp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
      entities: WORLD.entities.map((e) => (e.id === 'ash'
        ? {
          ...e, statLinks: [{ id: 'l-trust', originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null }],
          traits: e.traits!.map((t) => (t.id === 't-tamed' ? { ...t, statChanges: [{ statId: 'bp-trust', value: 5, type: 'max' }] } : t)),
        }
        : e)),
    } as World;
    renderTraitsTab(world, 'advanced');
    fireEvent.click(treeRow('Tamed')!);
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Trait Fields' })).getByRole('tab', { name: 'Stats' }));
    expect(screen.getByText('Trust')).toBeInTheDocument();
  });

  it('keeps the Stats tab and no owner line on a world trait', () => {
    renderTraitsTab(WORLD, 'advanced');
    fireEvent.click(treeRow('Paladin')!);
    expect(screen.queryByText(/^Owned by/)).toBeNull();
    const strip = screen.getByRole('tablist', { name: 'Trait Fields' });
    expect(within(strip).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Availability', 'Stats', 'Appearance', 'Pins', 'Scripts']);
  });

  it('writes an edit to its entity, never to the world\'s traits', () => {
    const { ctx } = renderTraitsTab(WORLD, 'advanced');
    fireEvent.click(treeRow('Tamed')!);
    openTraitFieldsTab('Availability');
    act(() => { fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Starts' })).getByRole('radio', { name: 'On' })); });
    expect(entity(ctx, 'ash').traits!.find((t) => t.id === 't-tamed')?.isDefault).toBe(true);
    expect(ctx().traits.map((t) => t.id)).toEqual(['t-paladin', 't-tamer']);
  });
});

describe('requirements across owners', () => {
  it('lists owned traits in the picker with where they live, and adds one to a world trait on its owner', async () => {
    const { ctx } = renderTraitsTab(WORLD, 'advanced');
    fireEvent.click(treeRow('Beast Tamer')!);
    openTraitFieldsTab('Availability');
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    const list = await screen.findByRole('listbox');
    const tamed = within(list).getByRole('option', { name: /^Tamed/ });
    expect(tamed).toHaveTextContent('TamedAsh › Bond');
    fireEvent.click(tamed);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Same OwnerWhoever has the trait', 'Persona', 'Ash']);
    fireEvent.click(screen.getByRole('option', { name: /^Ash/ }));
    expect(ctx().traits.find((t) => t.id === 't-tamer')?.requires)
      .toEqual([{ all: [{ kind: 'trait', id: 't-tamed', owner: { kind: 'entity', id: 'ash', name: 'Ash' } }] }]);
    expect(screen.getByRole('button', { name: 'Ash: Tamed' })).toBeInTheDocument();
  });
});
