import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { benchEditorWorld, entityFieldsTab, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { StatDropRefusalNotice } from '@/managers/WorldStatTree';
import type { StatDropRefusal } from '@/lib/ownedStatTree';
import type { Stat, World } from '@/types';

/**
 * Entity nodes on the Stats tab: an entity that owns stats shows as a node in the world's one tree, its rows open
 * and edit on the entity, and a refused drop explains itself. Where a drop lands is the stat tree's to test; this
 * covers the wiring an author touches.
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

const entity = (ctx: () => { entities: World['entities'] }, id: string) => ctx().entities.find((e) => e.id === id)!;

/** The stat panel's Max input, beside its label. */
const maxInput = () => screen.getAllByText('Max').find((el) => el.tagName === 'LABEL')!.parentElement!.querySelector('input')!;

beforeEach(() => { localStorage.clear(); });

describe('entity nodes on the Stats tab', () => {
  it('shows a node with a user icon for each entity that owns a stat, and none for one that owns nothing', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    const node = entityNodeRow('Ash')!;
    expect(node).toHaveTextContent(/AshPlayable$/);
    expect(node.querySelector('.lucide-user')).not.toBeNull();
    expect(entityNodeRow('Bram')).toHaveTextContent(/BramEntity$/);
    expect(entityNodeRow('Odd Wick')).toBeUndefined();
  });

  it('gives a node a drag grip, and no delete or duplicate', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    const node = entityNodeRow('Ash')!;
    expect(within(node).getByLabelText('Drag to reorder or nest')).toBeInTheDocument();
    expect(within(node).queryByTitle('Delete')).toBeNull();
    expect(within(node).queryByTitle('Duplicate')).toBeNull();
  });

  it('shows the nodes in Simple mode too', () => {
    renderWorldEditorBench(WORLD, 'simple');
    openEditorTab(/Stats/);
    expect(entityNodeRow('Ash')).toBeDefined();
  });

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

  it('opens an entity\'s own stat apart from a world stat with its id, and edits it on the entity', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    const [, ashHealth] = treeRows('Health');
    fireEvent.click(ashHealth);
    expect(maxInput().value).toBe('40');
    fireEvent.change(maxInput(), { target: { value: '45' } });
    fireEvent.blur(maxInput());
    expect(entity(ctx, 'ash').stats!.find((s) => s.id === 'hp')).toMatchObject({ max: 45 });
    expect(ctx().stats.find((s) => s.id === 'hp')).toMatchObject({ max: 100 });
  });

  it('edits and deletes an entity\'s own group and stat on the entity', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    fireEvent.click(treeRows('Bond')[0]);
    expect(screen.getByLabelText('Group Name')).toHaveTextContent('Bond');
    fireEvent.click(within(treeRows('Vigor')[0]).getByRole('button', { name: 'Delete' }));
    expect(entity(ctx, 'ash').stats!.map((s) => s.id)).toEqual(['hp']);
    expect(ctx().stats.map((s) => s.id)).toEqual(['hp', 'luck']);
  });

  it('opens a link row on the link\'s panel, and Detach turns it into the entity\'s own stat', () => {
    const linked = {
      ...WORLD,
      statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' as const }],
      stats: [...WORLD.stats, stat('bp-fear', 'Fear', { groupId: 'bp' })],
      entities: WORLD.entities.map((e) => (e.id === 'bram'
        ? { ...e, statLinks: [{ id: 'l1', originalId: 'bp-fear', kind: 'stat' as const, originalName: 'Fear', groupId: null, order: 1 }] }
        : e)),
    };
    const { ctx } = renderWorldEditorBench(linked, 'advanced');
    openEditorTab(/Stats/);
    const [, bramFear] = treeRows('Fear');
    fireEvent.click(bramFear);
    expect(screen.getByText(/^Linked from/)).toHaveTextContent('Linked from Blueprints › Fear');
    expect(screen.getByRole('button', { name: 'Reset to Blueprint' })).toBeInTheDocument();
    fireEvent.click(within(bramFear).getByRole('button', { name: 'Detach' }));
    expect(entity(ctx, 'bram').statLinks).toBeUndefined();
    expect(entity(ctx, 'bram').stats!.map((s) => s.id)).toEqual(['trust', 'bp-fear']);
  });

  it('keeps the search to world stats (Q12)', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);
    // Ash's Health and Bram's Trust match too, but only world stats list.
    fireEvent.change(screen.getByPlaceholderText('Filter Stats'), { target: { value: 't' } });
    const found = screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label'));
    expect(found).toEqual(['Select Health']);
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

  it('dims a disabled world stat and an entity-owned stat in the world tree, and marks each Off', () => {
    renderWorldEditorBench(OFF_WORLD, 'advanced');
    openEditorTab(/Stats/);
    const [worldHealth, ashHealth] = treeRows('Health');
    const [vigor] = treeRows('Vigor');
    expect(worldHealth).toHaveTextContent(/Off/);
    expect(opacityOf(worldHealth)).toBe('0.5');
    expect(vigor).toHaveTextContent(/Off/);
    expect(opacityOf(vigor)).toBe('0.5');
    // An enabled stat shows neither, though it shares the disabled one's id.
    expect(ashHealth).not.toHaveTextContent(/Off/);
    expect(opacityOf(ashHealth)).toBe('1');
    expect(treeRows('Luck')[0]).not.toHaveTextContent(/Off/);
  });

  it('drops the marker when the stat is enabled again', () => {
    const { ctx } = renderWorldEditorBench(OFF_WORLD, 'advanced');
    openEditorTab(/Stats/);
    expect(treeRows('Health')[0]).toHaveTextContent(/Off/);
    act(() => ctx().updateStat({ ...ctx().stats[0], enabled: true }));
    expect(treeRows('Health')[0]).not.toHaveTextContent(/Off/);
    expect(opacityOf(treeRows('Health')[0])).toBe('1');
  });

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

describe('the refused-drop note', () => {
  const noteFor = (refusal: StatDropRefusal) => {
    const { unmount } = render(<StatDropRefusalNotice refusal={refusal} placeholders={[]} onDismiss={() => {}} />);
    const text = screen.getByRole('status').textContent;
    unmount();
    return text;
  };

  it('says why the stat stays, for each reason', () => {
    expect(noteFor({ reason: 'read', name: 'Health', owner: null, reader: { kind: 'change', trait: 'Brave' } }))
      .toBe('Health stays a world stat, because Brave changes it. Remove that stat change first.Dismiss');
    expect(noteFor({ reason: 'read', name: 'Trust', owner: 'Bob', reader: { kind: 'readBy', stat: 'Mood' } }))
      .toBe("Trust stays Bob's stat, because the code of Mood reads it.Dismiss");
    expect(noteFor({ reason: 'read', name: 'Trust', owner: null, reader: { kind: 'readByTrait', trait: 'Watcher' } }))
      .toBe('Trust stays a world stat, because a script of Watcher reads it.Dismiss');
    expect(noteFor({ reason: 'read', name: 'Trust', owner: null, reader: { kind: 'readByWorld' } }))
      .toBe('Trust stays a world stat, because a world script reads it.Dismiss');
    expect(noteFor({ reason: 'into-blueprints', name: 'Luck', reader: { kind: 'toggle', trait: 'Lit' } }))
      .toBe('Luck stays out of Blueprints, because Lit switches it on or off. Remove that stat toggle first.Dismiss');
    expect(noteFor({ reason: 'duplicate', name: 'Trust', owner: 'Odette' })).toBe('Odette already has Trust.Dismiss');
    expect(noteFor({ reason: 'held', owner: 'Ash', held: { kind: 'inside', name: 'Social', group: 'Fear' } }))
      .toBe('Ash already links Social, which Fear holds.Dismiss');
    expect(noteFor({ reason: 'blueprint-linked', name: 'Trust', owners: ['Bram', 'Odette'] }))
      .toBe('Trust stays in Blueprints, because Bram and Odette link to it or to something in it. Remove those links first.Dismiss');
  });
});
