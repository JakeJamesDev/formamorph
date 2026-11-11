import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import {
  asMobile, benchEditorWorld, entityFieldsTab, openEditorTab, pickEditorMode, renderWorldEditorBench,
} from '@/test/worldEditorBench';
import type { Stat, World } from '@/types';

/** The Stats tab inside the editor: what only the view's wiring makes pass. The list, panel and tree cases run on the tab alone. */

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

// The real editor arrives on its own chunk and brings CodeMirror with it; the Scripts tab's shape is what these
// cases are about, so the field stands in as a plain box that still names itself.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; ariaLabel: string; label?: string }) => (
    <div><span>{props.label}</span><textarea aria-label={props.ariaLabel} defaultValue={props.value} /></div>
  ),
}));

beforeEach(() => { localStorage.clear(); });

describe('the shared search and the mobile layout', () => {
  const stat = (id: string, name: string, extra: Record<string, unknown> = {}) =>
    ({ id, name, type: 'number' as const, description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra });

  const WORLD: World = benchEditorWorld({
    stats: [stat('s-warmth', 'Warmth'), stat('s-damp', 'Damp'), stat('s-dread', 'Dread')],
  } as Partial<World>);

  const searchStats = (term: string) =>
    fireEvent.change(screen.getByPlaceholderText('Filter Stats'), { target: { value: term } });
  const shownName = () => {
    const field = screen.queryByLabelText('Name');
    if (!field) return null;
    return field instanceof HTMLInputElement ? field.value : field.textContent;
  };
  const detailPushed = () => document.querySelector('[data-list-detail] > [aria-hidden]')?.getAttribute('aria-hidden') === 'false';

  describe('the Stats tab', () => {
    // Drift log #2: kept until ruled.
    it('blanks the open stat\'s details while a search leaves it out', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Stats/);

      fireEvent.click(screen.getByText('Damp'));
      searchStats('Warm');
      expect(shownName()).toBeNull();
      searchStats('');
      expect(shownName()).toBe('Damp');
    });

    describe('on mobile', () => {
      let restore: () => void;
      beforeEach(() => { restore = asMobile(); });
      afterEach(() => restore());

      it('pushes the details over the list and goes back to it', () => {
        renderWorldEditorBench(WORLD, 'advanced');
        openEditorTab(/Stats/);

        fireEvent.click(screen.getByText('Damp'));
        expect(detailPushed()).toBe(true);
        expect(shownName()).toBe('Damp');
        fireEvent.click(screen.getByRole('button', { name: 'Back to Stats' }));
        expect(detailPushed()).toBe(false);
      });
    });
  });
});

describe('the stat panel and the editor mode', () => {
  const WORLD: World = benchEditorWorld({
    stats: [
      {
        id: 's1', name: 'Warmth', type: 'number', description: 'How thawed the traveler is.',
        min: 0, max: 10, value: 4, regen: 0, code: 'return 4;',
        descriptors: [{ id: 'd1', threshold: 3, description: 'chilled' }],
      },
      { id: 's2', name: 'Damp', type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [] },
      { id: 's3', name: 'Resolve', type: 'percentage', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] },
    ],
  } as Partial<World>);
  // These tabs switch on mouseDown, not click.
  const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));
  const FIELD_LABELS =
    /^(Name|Type|Description|Min|Max|Base Value|Base Value \(%\)|Regen|Sliders|Colors|Availability|Prevent AI Changes|Stat Descriptors|Scripts|Warmth · After the AI)$/;

  /** Every field label the panel shows, in document order. The panel's own strip carries a Scripts tab and a
   *  Details tab, so the match is taken from the panel body rather than the whole editor. */
  const panelLabels = () =>
    screen.getAllByText(FIELD_LABELS)
      // The strip, with its hidden measuring copies, names tabs, not fields.
      .filter((el) => !el.closest('[role="tablist"], [data-collapsing-root]'))
      .map((el) => el.textContent);
  /** The stat panel's own strip. The editor's top-level one carries a Stats tab of its own, so every read and
   *  click here is taken from the named strip rather than by tab name. */
  const panelStrip = () => screen.queryByRole('tablist', { name: 'Stat Fields' });

  const panelTabNames = () => {
    const strip = panelStrip();
    return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
  };

  const panelTab = (name: string) =>
    within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name });

  const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

  const selectStat = (name: string) => {
    openTab(/Stats/);
    fireEvent.click(screen.getByText(name));
  };

  describe('the World Editor stat panel tabs', () => {
    it('lands on Details when Simple mode takes the Scripts tab away, and restores Scripts in Advanced', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      selectStat('Warmth');
      openPanelTab('Scripts');

      pickEditorMode('Simple');
      expect(panelTabNames()).toEqual(['Details', 'Appearance']);
      expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
      expect(panelLabels()).toEqual([
        'Name', 'Type', 'Description', 'Base Value', 'Min', 'Max', 'Regen',
      ]);

      // The switch wears the hidden-data marker, whose own label joins its accessible name.
      pickEditorMode('Advanced');
      expect(panelTabNames()).toEqual(['Details', 'Appearance', 'Descriptors', 'Scripts']);
      expect(panelTab('Scripts')).toHaveAttribute('aria-selected', 'true');
    });
  });
});

describe('entity nodes and the Entities tab', () => {
  const stat = (id: string, name: string, over: Partial<Stat> = {}): Stat =>
    ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], ...over });

  const WORLD: World = benchEditorWorld({
    stats: [stat('hp', 'Health'), stat('luck', 'Luck')],
    entities: [
      { id: 'wick', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
      {
        id: 'ash', name: 'Ash', persona: true, playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
        statGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, order: 1 }],
        // Ash's own Health shares the world stat's id, as a persona's may.
        stats: [stat('vigor', 'Vigor', { groupId: null, order: 0 }), stat('hp', 'Health', { groupId: 'g-bond', order: 0, max: 40 })],
      },
      { id: 'bram', name: 'Bram', playerDescription: 'A smith.', aiDescription: 'A smith.', locations: ['harbor'], stats: [stat('trust', 'Trust')] },
    ],
  } as Partial<World>);
  /** A tree row found by its drag grip, so the panel's own copy of the name never matches. */
  const treeRows = (name: string) => screen.getAllByLabelText('Drag to reorder or nest')
    .map((grip) => grip.parentElement as HTMLElement)
    .filter((row) => within(row).queryByText(name));

  /** An entity node row, found by its chevron, which names it an entity rather than a group. */
  const entityNodeRow = (name: string) => screen.queryAllByRole('button', { name: /(Collapse|Expand) entity/ })
    .map((chevron) => chevron.parentElement as HTMLElement)
    .find((row) => within(row).queryByText(name));

  describe('entity nodes on the Stats tab', () => {
    it('opens the node on a panel with its name and a way to the entity\'s Stats tab', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Stats/);
      fireEvent.click(entityNodeRow('Ash')!);
      // The tree draws Vigor once: nothing beside it repeats Ash's stats.
      expect(screen.getAllByText('Vigor')).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Open Entity' }));
      expect(screen.getByRole('tab', { name: /Entities/, selected: true })).toBeInTheDocument();
      expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('the Off marker on a disabled stat', () => {
    const OFF_WORLD: World = {
      ...WORLD,
      stats: [stat('hp', 'Health', { enabled: false }), stat('luck', 'Luck')],
      entities: WORLD.entities.map((e) => (e.id === 'ash'
        ? { ...e, stats: e.stats!.map((s) => (s.id === 'vigor' ? { ...s, enabled: false } : s)) }
        : e)),
    };
    /** The row's own dim, read off the nearest ancestor that carries one. */
    const opacityOf = (row: HTMLElement) => {
      let el: HTMLElement | null = row;
      while (el && !el.style.opacity) el = el.parentElement;
      return el?.style.opacity;
    };

    it('marks an entity\'s own disabled stat on the entity Stats tab', () => {
      renderWorldEditorBench(OFF_WORLD, 'advanced');
      openEditorTab(/Entities/);
      fireEvent.click(screen.getByText('Ash'));
      fireEvent.mouseDown(entityFieldsTab('Stats'));
      const [vigor] = treeRows('Vigor');
      expect(vigor).toHaveTextContent(/Off/);
      expect(opacityOf(vigor)).toBe('0.5');
      expect(treeRows('Health')[0]).not.toHaveTextContent(/Off/);
    });
  });
});

describe('Blueprint links on an entity', () => {
  const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
    id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra,
  });

  const WORLD: World = benchEditorWorld({
    stats: [stat('s-warmth', 'Warmth'), stat('bp-trust', 'Trust', { groupId: 'bp', value: 5 })],
    statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, order: 1, system: 'blueprints' }],
    entities: [
      { id: 'ash', name: 'Ash', playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'] },
    ],
  } as Partial<World>);

  const openMirror = (name: string) => {
    openEditorTab(/Entities/);
    fireEvent.click(screen.getAllByText(name)[0]);
    fireEvent.mouseDown(entityFieldsTab('Stats'));
  };
  const openAddMenu = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Add to ${name}` }));
  const pickBlueprint = (action: 'Link Stat', name: string) => {
    fireEvent.click(screen.getByRole('button', { name: action }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Blueprints' })).getByRole('button', { name }));
  };
  const entityOf = (ctx: () => { entities: World['entities'] }) => ctx().entities.find((e) => e.id === 'ash')!;
  /** The Details tab's number fields, in the order the panel draws them. */
  const numberField = (name: 'Base Value' | 'Min' | 'Max' | 'Regen') =>
    screen.getAllByRole('spinbutton')[['Base Value', 'Min', 'Max', 'Regen'].indexOf(name)];

  describe('Link Stat on an entity', () => {
    it('links a Blueprint once, reads it live and shows where it is linked from', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
      openMirror('Ash');
      openAddMenu('Ash');
      pickBlueprint('Link Stat', 'Trust');

      expect(entityOf(ctx).statLinks).toEqual([expect.objectContaining({ originalId: 'bp-trust', kind: 'stat', groupId: null })]);
      expect(entityOf(ctx).stats).toBeUndefined();
      expect(screen.getByText(/Linked from/)).toHaveTextContent('Linked from Blueprints › Trust');
      expect(numberField('Base Value')).toHaveValue(5);

      act(() => ctx().updateStat(stat('bp-trust', 'Trust', { groupId: 'bp', value: 7 })));
      expect(numberField('Base Value')).toHaveValue(7);

      openAddMenu('Ash');
      fireEvent.click(screen.getByRole('button', { name: 'Link Stat' }));
      const trust = within(screen.getByRole('group', { name: 'Blueprints' })).getByRole('button', { name: 'Trust' });
      expect(trust).toHaveAttribute('aria-disabled', 'true');
      expect(trust).toHaveAttribute('aria-description', 'Ash already links Trust');
    });

    it('overrides a field with its own Reset, marks it stale when the Blueprint moves, and resets everything', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
      openMirror('Ash');
      openAddMenu('Ash');
      pickBlueprint('Link Stat', 'Trust');

      fireEvent.change(numberField('Base Value'), { target: { value: '9' } });
      fireEvent.change(numberField('Regen'), { target: { value: '2' } });
      expect(entityOf(ctx).statLinks![0].overrides).toEqual({
        'bp-trust': { value: { value: 9, blueprint: 5 }, regen: { value: 2, blueprint: 0 } },
      });
      expect(ctx().stats.find((s) => s.id === 'bp-trust')!.value).toBe(5);
      expect(screen.queryByText('Blueprint changed')).toBeNull();

      act(() => ctx().updateStat(stat('bp-trust', 'Trust', { groupId: 'bp', value: 6 })));
      expect(screen.getAllByText('Blueprint changed')).toHaveLength(1);
      expect(numberField('Base Value')).toHaveValue(9);

      fireEvent.click(screen.getByRole('button', { name: 'Reset Base Value' }));
      expect(numberField('Base Value')).toHaveValue(6);
      expect(Object.keys(entityOf(ctx).statLinks![0].overrides!['bp-trust'])).toEqual(['regen']);

      fireEvent.click(screen.getByRole('button', { name: 'Reset to Blueprint' }));
      expect(entityOf(ctx).statLinks![0].overrides).toBeUndefined();
      expect(numberField('Regen')).toHaveValue(0);
    });

    it('keeps the name the Blueprint\'s', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openMirror('Ash');
      openAddMenu('Ash');
      pickBlueprint('Link Stat', 'Trust');
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('contenteditable', 'false');
    });
  });

  /** The tree or list row that holds `text` and an action named `action`. */
  const rowWith = (text: string, action: string): HTMLElement => {
    let row: HTMLElement | null = screen.getAllByText(text)[0];
    while (row && !within(row).queryByRole('button', { name: action })) row = row.parentElement;
    return row!;
  };

  describe('Detach on an entity', () => {
    it('offers no Copy Stat', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openMirror('Ash');
      openAddMenu('Ash');
      expect(screen.getByRole('button', { name: 'Link Stat' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Copy Stat' })).toBeNull();
    });

    it('turns a link into the entity\'s own stat under the Blueprint\'s id at once, with its current values', () => {
      const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
      openMirror('Ash');
      openAddMenu('Ash');
      pickBlueprint('Link Stat', 'Trust');
      fireEvent.change(numberField('Base Value'), { target: { value: '9' } });
      fireEvent.click(screen.getByRole('button', { name: 'Back to Stats' }));

      fireEvent.click(within(rowWith('Trust', 'Detach')).getByRole('button', { name: 'Detach' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(entityOf(ctx).statLinks).toBeUndefined();
      expect(entityOf(ctx).stats).toEqual([expect.objectContaining({ id: 'bp-trust', name: 'Trust', value: 9, groupId: null })]);
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('contenteditable', 'true');

      act(() => ctx().updateStat(stat('bp-trust', 'Trust', { groupId: 'bp', value: 2, max: 50 })));
      expect(entityOf(ctx).stats![0]).toMatchObject({ value: 9, max: 10 });
    });

    it('explains why the Blueprint can no longer be linked, in Link Stat and in Link To…', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openMirror('Ash');
      openAddMenu('Ash');
      pickBlueprint('Link Stat', 'Trust');
      fireEvent.click(screen.getByRole('button', { name: 'Back to Stats' }));
      fireEvent.click(within(rowWith('Trust', 'Detach')).getByRole('button', { name: 'Detach' }));

      openAddMenu('Ash');
      fireEvent.click(screen.getByRole('button', { name: 'Link Stat' }));
      const trust = within(screen.getByRole('group', { name: 'Blueprints' })).getByRole('button', { name: 'Trust' });
      expect(trust).toHaveAttribute('aria-disabled', 'true');
      expect(trust).toHaveAttribute('aria-description', 'Ash already owns Trust');
      fireEvent.keyDown(screen.getByRole('group', { name: 'Blueprints' }), { key: 'Escape' });

      openEditorTab(/Stats/);
      // The Blueprint comes first; Ash's detached Trust draws under Ash's node below.
      fireEvent.click(screen.getAllByText('Trust')[0]);
      fireEvent.click(screen.getByRole('button', { name: 'Link To…' }));
      expect(within(screen.getByRole('group', { name: 'Link To' })).getByRole('button', { name: 'Ash' }))
        .toHaveAttribute('aria-description', 'Already owns Trust');
    });
  });

  describe('a group link', () => {
    const GROUPED: World = {
      ...WORLD,
      stats: [...WORLD.stats, stat('bp-fear', 'Fear', { groupId: 'bp-social', value: 3 })],
      statGroups: [...WORLD.statGroups!, { id: 'bp-social', name: 'Social', parentId: 'bp', order: 1 }],
    };

    it('draws the group in the entity\'s tree, each stat fixed and overridden on its own', () => {
      const linked = { ...GROUPED, entities: [{ ...GROUPED.entities[0], statLinks: [{ id: 'l1', originalId: 'bp-social', kind: 'group' as const, originalName: 'Social', groupId: null }] }] };
      const { ctx } = renderWorldEditorBench(linked, 'advanced');
      openMirror('Ash');
      expect(within(rowWith('Fear', 'Remove')).getByRole('button', { name: 'Remove' })).toHaveAttribute('aria-disabled', 'true');
      expect(within(rowWith('Social', 'Detach')).getByRole('button', { name: 'Remove Link' })).toBeInTheDocument();

      fireEvent.click(screen.getByText('Fear'));
      expect(screen.getByText(/Part of the linked/)).toHaveTextContent('Part of the linked Blueprints › Social');
      expect(within(rowWith('Social', 'Detach')).queryByLabelText('Modified for this link')).toBeNull();
      fireEvent.change(numberField('Base Value'), { target: { value: '8' } });
      expect(entityOf(ctx).statLinks![0].overrides).toEqual({ 'bp-fear': { value: { value: 8, blueprint: 3 } } });
      fireEvent.click(screen.getByRole('button', { name: 'Back to Stats' }));
      expect(within(rowWith('Social', 'Detach')).getByLabelText('Modified for this link')).toBeInTheDocument();
    });
  });
});
