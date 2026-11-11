import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  asMobile, benchEditorWorld, clickFlask, entityFieldsTab, openEditorTab, openTraitFieldsTab, pickEditorMode, renderWorldEditorBench, searchWorldField,
} from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The Traits tab inside the editor: what only the view's wiring makes pass. The list, panel and tree cases run on the tab alone. */

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

beforeEach(() => { localStorage.clear(); });

describe('the Traits tab and the editor selections', () => {
  const WORLD: World = benchEditorWorld({
    stats: [
      { id: 's-warmth', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] },
      { id: 's-damp', name: 'Damp', type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [] },
    ],
    traitGroups: [
      { id: 'g-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' },
      { id: 'g-classes', name: 'Classes', parentId: 'g-blueprints', order: 0 },
    ],
    traits: [
      { id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'g-classes' },
      { id: 't-tamer', name: 'Beast Tamer', statChanges: [], groupId: 'g-blueprints', order: 1 },
      // One Bench finding: a pin naming a placeholder that doesn't exist.
      { id: 't-oath', name: 'Hollow Oath', statChanges: [], order: 2, placeholderPins: [{ placeholderId: 'gone', value: 'ash' }] },
    ],
    entities: [
      {
        id: 'ash', name: 'Ash', persona: true, playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
        traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null }],
        traits: [{ id: 't-tamed', name: 'Tamed', groupId: 'g-bond', statChanges: [] }],
      },
      {
        id: 'rook', name: 'Rook', playerDescription: 'A ranger.', aiDescription: 'A ranger.', locations: ['harbor'],
        traitLinks: [
          { id: 'l-tamer', originalId: 't-tamer', kind: 'trait', originalName: 'Beast Tamer', groupId: null, order: 0 },
          { id: 'l-classes', originalId: 'g-classes', kind: 'group', originalName: 'Classes', groupId: null, order: 1 },
        ],
      },
    ],
  } as Partial<World>);

  /** A tree row's label. A linked group repeats its original's rows, so the world's own row comes first. */
  const clickTreeRow = (name: string) => fireEvent.click(screen.getAllByText(name)[0]);

  /** Whether the mobile push shows its detail, empty or not. The pane hides whichever side is off screen. */
  const detailPushed = () => document.querySelector('[data-list-detail] > [aria-hidden]')?.getAttribute('aria-hidden') === 'false';

  /** The open detail's Name field, which every trait and stat panel leads with. */
  const shownName = () => {
    const field = screen.getByLabelText('Name');
    return field instanceof HTMLInputElement ? field.value : field.textContent;
  };

  describe('one selection per tab', () => {
    it('reopens each tab on its own selection', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Traits/);
      clickTreeRow('Paladin');
      expect(shownName()).toBe('Paladin');

      openEditorTab(/Stats/);
      expect(screen.queryByLabelText('Name')).toBeNull();
      fireEvent.click(screen.getByText('Damp'));
      expect(shownName()).toBe('Damp');

      openEditorTab(/Traits/);
      expect(shownName()).toBe('Paladin');
      openEditorTab(/Stats/);
      expect(shownName()).toBe('Damp');
    });

    it('lands a Find hit on its own tab and leaves the other tabs\' selections alone', async () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Traits/);
      clickTreeRow('Paladin');

      fireEvent.change(searchWorldField(), { target: { value: 'Damp' } });
      await waitFor(() => expect(screen.getByRole('tab', { name: /Stats/, selected: true })).toBeInTheDocument());
      expect(shownName()).toBe('Damp');
      fireEvent.keyDown(searchWorldField(), { key: 'Escape' });

      openEditorTab(/Traits/);
      expect(shownName()).toBe('Paladin');
    });

    it('opens a Bench finding on its own tab and leaves the other tabs\' selections alone', async () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Stats/);
      fireEvent.click(screen.getByText('Damp'));

      await clickFlask();
      // The popover names the finding's trait on its row and its dismiss control; the row is the first.
      fireEvent.click((await screen.findAllByRole('button', { name: 'Hollow Oath' }))[0]);
      await waitFor(() => expect(screen.getByRole('tab', { name: /Traits/, selected: true })).toBeInTheDocument());
      expect(shownName()).toBe('Hollow Oath');

      openEditorTab(/Stats/);
      expect(shownName()).toBe('Damp');
    });

    describe('on mobile', () => {
      let restore: () => void;
      beforeEach(() => { restore = asMobile(); });
      afterEach(() => restore());

      it('shows the next tab\'s list, not a pushed empty detail', () => {
        renderWorldEditorBench(WORLD, 'advanced');
        openEditorTab(/Traits/);
        clickTreeRow('Paladin');
        expect(screen.getByRole('button', { name: 'Back to Traits' })).toBeInTheDocument();

        openEditorTab(/Stats/);
        expect(detailPushed()).toBe(false);

        openEditorTab(/Traits/);
        expect(screen.getByRole('button', { name: 'Back to Traits' })).toBeInTheDocument();
        expect(shownName()).toBe('Paladin');
      });

      it('forgets a selection whose item is gone rather than pushing an empty detail', () => {
        const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
        openEditorTab(/Traits/);
        clickTreeRow('Tamed');
        expect(detailPushed()).toBe(true);
        openEditorTab(/Stats/);
        act(() => ctx().editEntity('ash', (e) => ({ ...e, traits: [] })));

        openEditorTab(/Traits/);
        expect(detailPushed()).toBe(false);
      });
    });
  });
});

describe('the trait panel and the editor mode', () => {
  const WORLD: World = benchEditorWorld({
    stats: [
      { id: 's1', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] },
      { id: 's2', name: 'Damp', type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [] },
    ],
    placeholders: [{ id: 'p1', name: 'Hair Color', values: [{ id: 'v1', text: 'copper' }] }],
    traitGroups: [{ id: 'g1', name: 'Upbringing', parentId: null }],
    traits: [
      {
        id: 't1', name: 'Sedge-Born', playerDescription: 'Fen-raised.', aiDescription: 'Grew up in the fen.',
        statChanges: [{ statId: 's1', value: 2, type: 'min' }],
        statToggles: [{ statId: 's2', enabled: true }],
        placeholderPins: [{ placeholderId: 'p1', value: 'copper' }],
      },
      // A second trait in a group of its own, so the persistence case crosses a group boundary.
      { id: 't2', name: 'Marsh-Wed', groupId: 'g1', statChanges: [] },
    ],
  } as Partial<World>);

  // These tabs switch on mouseDown, not click.
  const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

  const FIELD_LABELS =
    /^(Name|Player-Facing Description|AI-Facing Description|Requires|Stat Changes|Stat Availability|Placeholder Pins)$/;

  /** Every field label the panel shows, in document order. The panel's own strip carries a Stats tab and a
   *  Details tab, so the match is taken from the panel body rather than the whole editor. */
  const panelLabels = () =>
    screen.getAllByText(FIELD_LABELS)
      .filter((el) => !el.closest('[role="tablist"]'))
      .map((el) => el.textContent);

  /** The trait panel's own strip. The editor's top-level strip carries a Stats tab of its own, so every read
   *  and click here is taken from the named strip rather than by tab name. */
  const panelStrip = () => screen.queryByRole('tablist', { name: 'Trait Fields' });

  const panelTabNames = () => {
    const strip = panelStrip();
    return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
  };

  const panelTab = (name: string) =>
    within(screen.getByRole('tablist', { name: 'Trait Fields' })).getByRole('tab', { name });

  const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

  const selectTrait = (name: string) => {
    openTab(/Traits/);
    fireEvent.click(screen.getByText(name));
  };

  describe('the World Editor trait panel tabs', () => {
    it('lands on Details when Simple mode takes the Pins tab away, and restores the strip', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      selectTrait('Sedge-Born');
      openPanelTab('Pins');

      pickEditorMode('Simple');
      expect(panelTabNames()).toEqual(['Details', 'Availability', 'Stats', 'Appearance']);
      expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
      expect(panelLabels()).toEqual(['Name', 'Player-Facing Description', 'AI-Facing Description']);

      // The switch wears the hidden-data marker, whose own label joins its accessible name.
      pickEditorMode('Advanced');
      expect(panelTabNames()).toEqual(['Details', 'Availability', 'Stats', 'Appearance', 'Pins', 'Scripts']);
    });
  });
});

describe('a requirement that opens an entity', () => {
  const WORLD: World = benchEditorWorld({
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

  const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

  /** The tree row that draws `name`, found by its drag grip so the panel's own copy of the name never matches. */
  const treeRow = (name: string) => screen.getAllByLabelText('Drag to reorder or nest')
    .map((grip) => grip.parentElement as HTMLElement)
    .find((row) => within(row).queryByText(name)) as HTMLElement;

  const selectTrait = (name: string) => {
    openTab(/Traits/);
    fireEvent.click(treeRow(name));
    openTraitFieldsTab('Availability');
  };

  /** The Requires field's body, from its label down. */
  const requiresField = () => screen.getByRole('group', { name: 'Requires' });

  const selectedRowText = () => document.querySelector('[data-editor-row-selected]')?.textContent;

  describe('the Requires field', () => {
    it('opens the target trait from its chip', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      selectTrait('Plate Armor');
      fireEvent.click(within(requiresField()).getByRole('button', { name: 'Paladin' }));
      expect(selectedRowText()).toBe('Paladin');
    });

    it('opens a group chip\'s group and a playing-as chip\'s entity', () => {
      const world = benchEditorWorld({
        ...WORLD,
        traits: WORLD.traits.map((t) => (t.id === 't-plate'
          ? { ...t, requires: [{ all: [{ kind: 'group', id: 'g-class' }] }, { all: [{ kind: 'playingAs', id: 'aldric' }] }] }
          : t)),
      } as Partial<World>);
      renderWorldEditorBench(world, 'advanced');
      selectTrait('Plate Armor');
      fireEvent.click(within(requiresField()).getByRole('button', { name: 'any Class' }));
      expect(selectedRowText()).toBe('Class');

      selectTrait('Plate Armor');
      fireEvent.click(within(requiresField()).getByRole('button', { name: 'playing as Sir Aldric' }));
      expect(screen.getByRole('tab', { name: /Entities/ })).toHaveAttribute('aria-selected', 'true');
      expect(selectedRowText()).toContain('Sir Aldric');
    });
  });
});

describe('owned traits and the Entities tab', () => {
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
  });

  describe('an owned trait\'s panel', () => {
    it('names its owner at the top of Details, and has a Stats tab on a persona (Q10)', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openTab(/Traits/);
      fireEvent.click(treeRow('Tamed')!);
      expect(screen.getByText(/^Owned by/)).toHaveTextContent('Owned by Ash');
      expect(screen.getByText("Describes this entity to the AI, and joins the player's traits when they play as it")).toBeInTheDocument();
      const strip = screen.getByRole('tablist', { name: 'Trait Fields' });
      expect(within(strip).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Availability', 'Stats', 'Appearance', 'Pins', 'Scripts']);
      // Tamed names no player stat, so the persona note stays away.
      fireEvent.mouseDown(within(strip).getByRole('tab', { name: 'Stats' }));
      expect(screen.queryByText(/stat changes apply/i)).toBeNull();

      fireEvent.mouseDown(within(strip).getByRole('tab', { name: 'Details' }));
      fireEvent.click(screen.getByRole('button', { name: 'Ash' }));
      expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
    });
  });

  describe('requirements across owners', () => {
    it('reads a world requirement on an owned trait by name, and opens it', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openTab(/Traits/);
      fireEvent.click(treeRow('Wild')!);
      openTraitFieldsTab('Availability');
      fireEvent.click(screen.getByRole('button', { name: 'Paladin' }));
      expect(selectedRowText()).toBe('Paladin');
    });
  });
});
