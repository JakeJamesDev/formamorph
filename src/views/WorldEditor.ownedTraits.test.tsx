import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  benchEditorWorld, entityFieldsTab, openEditorTab, openTraitFieldsTab, renderWorldEditorBench,
} from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * Owned traits in the World Editor: the entity panel's Traits tab, entity nodes on the Traits tab, and an owned
 * trait's panel. Where a drop lands is the trait tree's to test; this covers the wiring an author touches.
 */

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

const openTab = openEditorTab;


/** A tree row found by its drag grip, so the panel's own copy of the name never matches. */
const treeRow = (name: string) => screen.getAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name));

/** An entity node row, found by its chevron, which names it an entity rather than a group. */
const entityNodeRow = (name: string) => screen.queryAllByRole('button', { name: /(Collapse|Expand) entity/ })
  .map((chevron) => chevron.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name));

const entity = (ctx: () => { entities: World['entities'] }, id: string) => ctx().entities.find((e) => e.id === id)!;

/** The last selected row: the trait tree's, past the entity tree's own selected row when both show. */
const selectedRowText = () => [...document.querySelectorAll('[data-editor-row-selected]')].at(-1)?.textContent;

beforeEach(() => { localStorage.clear(); });

/** The entity Traits tab's own + menu, apart from the editor's. Its label names the entity. */
const openEntityAddMenu = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Add to ${name}` }));

describe('the entity panel Traits tab', () => {
  it('adds an entity\'s first trait in place, which gives it a node on the Traits tab', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Entities/);
    fireEvent.click(screen.getAllByText('Odd Wick')[0]);
    fireEvent.mouseDown(entityFieldsTab('Traits'));
    expect(screen.getByText(/Add a trait to give this entity a node on the/)).toBeInTheDocument();

    openEntityAddMenu('Odd Wick');
    fireEvent.click(screen.getByRole('button', { name: 'Add Trait to Odd Wick' }));
    const [added] = entity(ctx, 'wick').traits!;
    expect(added).toMatchObject({ name: 'New Trait', statChanges: [], groupId: null });

    // The author stays in the entity: its panel is still up, with the new trait's details open.
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
    expect(entityFieldsTab('Traits')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Name')).toHaveTextContent('New Trait');

    openTab(/Traits/);
    expect(entityNodeRow('Odd Wick')).toHaveTextContent(/Odd WickEntity$/);
  });

  it('lists the entity\'s own groups and traits as the Traits tab draws them, and opens one in place', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Entities/);
    fireEvent.click(screen.getAllByText('Ash')[0]);
    fireEvent.mouseDown(entityFieldsTab('Traits'));
    expect(['Bond', 'Tamed', 'Wild'].map((name) => treeRow(name)).every(Boolean)).toBe(true);
    expect(within(treeRow('Bond')!).getByRole('button', { name: 'Collapse group' })).toBeInTheDocument();

    fireEvent.click(treeRow('Wild')!);
    expect(selectedRowText()).toBe('Wild1');
    expect(screen.getByLabelText('Name')).toHaveTextContent('Wild');
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
  });

  it('shows the tab only in Advanced mode', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openTab(/Entities/);
    fireEvent.click(screen.getAllByText('Odd Wick')[0]);
    expect(within(screen.getByRole('tablist', { name: 'Entity Fields' })).queryByRole('tab', { name: 'Traits' })).toBeNull();
  });
});

describe('entity nodes on the Traits tab', () => {
  it('shows a node with a user icon for each entity that owns a trait, and none for one that owns nothing', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    const node = entityNodeRow('Ash')!;
    expect(node).toHaveTextContent(/AshPlayable$/);
    expect(node.querySelector('.lucide-user')).not.toBeNull();
    expect(node.querySelector('.lucide-folder')).toBeNull();
    expect(entityNodeRow('Odd Wick')).toBeUndefined();
  });

  it('gives a node a drag grip, and no delete or duplicate', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    const node = entityNodeRow('Ash')!;
    expect(within(node).getByLabelText('Drag to reorder or nest')).toBeInTheDocument();
    expect(within(node).queryByTitle('Delete')).toBeNull();
    expect(within(node).queryByTitle('Duplicate')).toBeNull();
  });

  it('keeps the node while the entity owns a group, and drops it once it owns nothing', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    for (const name of ['Tamed', 'Wild']) {
      fireEvent.click(within(treeRow(name)!).getByRole('button', { name: 'Delete' }));
    }
    expect(entity(ctx, 'ash').traits).toBeUndefined();
    expect(entityNodeRow('Ash')).toBeDefined();
    fireEvent.click(within(treeRow('Bond')!).getByRole('button', { name: 'Delete' }));
    expect(entity(ctx, 'ash').traitGroups).toBeUndefined();
    expect(entityNodeRow('Ash')).toBeUndefined();
  });

  it('gives an entity a node when its first add is a group', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Entities/);
    fireEvent.click(screen.getAllByText('Odd Wick')[0]);
    fireEvent.mouseDown(entityFieldsTab('Traits'));
    openEntityAddMenu('Odd Wick');
    fireEvent.click(screen.getByRole('button', { name: 'Add Group to Odd Wick' }));
    expect(entity(ctx, 'wick').traitGroups).toEqual([expect.objectContaining({ name: 'New Group', parentId: null })]);
    expect(screen.getByLabelText('Group Name')).toHaveTextContent('New Group');
    openTab(/Traits/);
    expect(entityNodeRow('Odd Wick')).toBeDefined();
  });

  it('opens the node on a panel with its name and a way to the entity, and no list of its traits', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(entityNodeRow('Ash')!);
    expect(screen.queryByRole('list', { name: 'Owned Traits' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add (Trait|Group)/ })).toBeNull();
    // The tree draws the names once each: nothing beside it repeats them.
    expect(screen.getAllByText('Tamed')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open Entity' }));
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
    expect(entityFieldsTab('Traits')).toHaveAttribute('aria-selected', 'true');
  });

  it('edits an owned group like a world one, writing to its entity', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(treeRow('Bond')!);
    // A max of 2 matches no preset, so the count fields show without opening the select.
    fireEvent.change(screen.getByLabelText('At Most'), { target: { value: '1' } });
    expect(entity(ctx, 'ash').traitGroups).toEqual([expect.objectContaining({ id: 'g-bond', maxPicks: 1 })]);
    expect(ctx().traitGroups).toEqual([]);
  });
});

describe('an owned trait\'s panel', () => {
  it('names its owner at the top of Details, and has a Stats tab on a persona (Q10)', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(treeRow('Tamed')!);
    expect(screen.getByText(/^Owned by/)).toHaveTextContent('Owned by Ash');
    expect(screen.getByText('Describes them to the AI, and joins your traits when you play as them')).toBeInTheDocument();
    const strip = screen.getByRole('tablist', { name: 'Trait Fields' });
    expect(within(strip).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Availability', 'Stats', 'Pins', 'Scripts']);
    // Tamed names no player stat, so the persona note stays away.
    fireEvent.mouseDown(within(strip).getByRole('tab', { name: 'Stats' }));
    expect(screen.queryByText(/stat changes apply/i)).toBeNull();

    fireEvent.mouseDown(within(strip).getByRole('tab', { name: 'Details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ash' }));
    expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
  });

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
      openTab(/Traits/);
      fireEvent.click(treeRow('Tamed')!);
      const strip = screen.getByRole('tablist', { name: 'Trait Fields' });
      expect(within(strip).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Availability', 'Stats', 'Pins', 'Scripts']);
      fireEvent.mouseDown(within(strip).getByRole('tab', { name: 'Stats' }));
    };
    const { unmount } = renderWorldEditorBench(withStats(false, 'vigor'), 'advanced');
    statsTab();
    expect(screen.getByText('Vigor')).toBeInTheDocument();
    unmount();

    // A cast entity nobody plays is offered the Global stats under their own heading, and its row reads one.
    renderWorldEditorBench(withStats(false, 'hp'), 'advanced');
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
    const { ctx } = renderWorldEditorBench(world, 'advanced');
    openTab(/Traits/);
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
    renderWorldEditorBench(world, 'advanced');
    openTab(/Traits/);
    fireEvent.click(treeRow('Tamed')!);
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Trait Fields' })).getByRole('tab', { name: 'Stats' }));
    expect(screen.getByText('Trust')).toBeInTheDocument();
  });

  it('keeps the Stats tab and no owner line on a world trait', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(treeRow('Paladin')!);
    expect(screen.queryByText(/^Owned by/)).toBeNull();
    const strip = screen.getByRole('tablist', { name: 'Trait Fields' });
    expect(within(strip).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Availability', 'Stats', 'Pins', 'Scripts']);
  });

  it('writes an edit to its entity, never to the world\'s traits', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(treeRow('Tamed')!);
    openTraitFieldsTab('Availability');
    act(() => { fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Starts' })).getByRole('radio', { name: 'On' })); });
    expect(entity(ctx, 'ash').traits!.find((t) => t.id === 't-tamed')?.isDefault).toBe(true);
    expect(ctx().traits.map((t) => t.id)).toEqual(['t-paladin', 't-tamer']);
  });
});

describe('requirements across owners', () => {
  it('lists owned traits in the picker with where they live, and adds one to a world trait on its owner', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
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

  it('reads a world requirement on an owned trait by name, and opens it', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTab(/Traits/);
    fireEvent.click(treeRow('Wild')!);
    openTraitFieldsTab('Availability');
    fireEvent.click(screen.getByRole('button', { name: 'Paladin' }));
    expect(selectedRowText()).toBe('Paladin');
  });
});
