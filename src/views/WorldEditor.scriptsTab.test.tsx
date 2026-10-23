import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import { frames } from '@/test/landing';
import { LANDING_PULSE_CLASS, landingTarget } from '@/lib/landingPulse';
import { SCRIPT_TIMING_DESCRIPTION } from '@/lib/scripts';
import type { SortableTreeAdapter } from '@/managers/SortableTree';
import type { World } from '@/types';

/**
 * The World Editor's Scripts tab, driven through the real editor: every script under its timing in run order,
 * a drag within a timing, a refused drag across timings, one box edited from either place, and a world script
 * added from the tab, each one undone.
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

// The real editor arrives on its own chunk with CodeMirror; a plain box that names itself and writes back stands in.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; ariaLabel: string; onChange: (value: string) => void; owner?: unknown }) => (
    <textarea
      aria-label={props.ariaLabel} value={props.value} onChange={(e) => props.onChange(e.target.value)}
      data-owner={JSON.stringify(props.owner ?? null)}
    />
  ),
}));

// The tree's drop is driven through its adapter: jsdom has no layout for a pointer drag to land anywhere.
let tree: SortableTreeAdapter<{ id: string; depth: number }> | null = null;
vi.mock('@/managers/SortableTree', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/managers/SortableTree')>();
  return {
    ...actual,
    SortableTree: (props: Parameters<typeof actual.SortableTree<{ id: string; depth: number }>>[0]) => {
      if (props.adapter.getVisible(new Set()).some((row) => row.id.startsWith('timing:'))) tree = props.adapter;
      return <actual.SortableTree {...props} />;
    },
  };
});

const stat = (id: string, name: string, extra: object = {}) =>
  ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra });

const WORLD: World = benchEditorWorld({
  scripts: [{ id: 'weather', timing: 'after', code: 'stats.Warmth.value = 2;' }],
  stats: [
    stat('warmth', 'Warmth', {
      scripts: [{ id: 'w-after', timing: 'after', code: 'return 4;' }, { id: 'w-before', timing: 'before', code: 'return 1;' }],
    }),
  ],
  traits: [{ id: 'brave', name: 'Brave', statChanges: [], scripts: [{ id: 'b-after', timing: 'after', code: 'stats.Warmth.value = 3;' }] }],
  entities: [{
    id: 'resident', name: 'Odd Wick', locations: ['harbor'],
    stats: [stat('rage', 'Rage', { scripts: [{ id: 'r-after', timing: 'after', code: 'owner.stats.Rage.value = 1;', name: 'Temper' }] })],
  }],
} as Partial<World>);

const rowKey = (label: string) => tree!.getVisible(new Set()).find((row) => {
  const spec = tree!.rowSpec(row, () => {});
  return typeof spec.label !== 'string' && (spec.label as { props?: { text?: string } }).props?.text === label;
})!.id;

const openScripts = () => openEditorTab(/^Scripts/);
const selectRow = (label: string) => fireEvent.click(screen.getAllByText(label).find((el) => !el.closest('[role="group"]'))!);
const codeBox = (label: string) => screen.getByRole('textbox', { name: `Code ${label}` }) as HTMLTextAreaElement;

beforeEach(() => {
  localStorage.clear();
  tree = null;
});

describe('the Scripts tab', () => {
  it('lists every script under its timing, in the order the runner uses', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    const rows = tree!.getVisible(new Set()).map((row) => row.id.split('|')[0]);
    expect(rows).toEqual([
      'timing:before', 'stat/warmth',
      'timing:after', 'world', 'stat/warmth', 'trait/brave', 'entity/resident/rage',
      'timing:output', 'timing:start', 'timing:switch',
    ]);
    expect(screen.getByText('World · After the AI')).toBeInTheDocument();
    expect(screen.getByText('Temper')).toBeInTheDocument();
  });

  it('selects a timing and shows when it runs, then keeps the selection through a script edit', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    expect(screen.queryByText(SCRIPT_TIMING_DESCRIPTION.start)).toBeNull();
    selectRow('At Game Start');
    expect(screen.getByText(SCRIPT_TIMING_DESCRIPTION.start)).toBeInTheDocument();
    act(() => bench.ctx().setWorldScripts([...bench.ctx().worldScripts, { id: 'roll', timing: 'start', code: '' }]));
    expect(screen.getByText(SCRIPT_TIMING_DESCRIPTION.start)).toBeInTheDocument();
    selectRow('When a Trait Switches');
    expect(screen.getByText(SCRIPT_TIMING_DESCRIPTION.switch)).toBeInTheDocument();
    expect(screen.queryByText(SCRIPT_TIMING_DESCRIPTION.start)).toBeNull();
  });

  it('reorders within a timing, writes order on the moved scripts, and undoes the drop in one step', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    act(() => tree!.onDrop(rowKey('Brave · After the AI'), rowKey('World · After the AI'), 0, new Set()));
    expect(bench.ctx().traits[0].scripts![0].order).toBe(0);
    expect(bench.ctx().worldScripts[0].order).toBe(1);
    expect(bench.ctx().stats[0].scripts!.map((s) => s.order)).toEqual([2, undefined]);
    expect(bench.ctx().entities[0].stats![0].scripts![0].order).toBe(3);
    const after = tree!.getVisible(new Set()).filter((row) => row.id.includes('|')).map((row) => row.id.split('|')[0]);
    expect(after.slice(1)).toEqual(['trait/brave', 'world', 'stat/warmth', 'entity/resident/rage']);

    act(() => bench.history().undo());
    expect(bench.ctx().traits[0].scripts![0].order).toBeUndefined();
    expect(bench.ctx().worldScripts[0].order).toBeUndefined();
    expect(bench.ctx().stats[0].scripts![0].order).toBeUndefined();
    expect(bench.ctx().entities[0].stats![0].scripts![0].order).toBeUndefined();
  });

  it('snaps a drop across timings back and says why', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    const world = bench.ctx().getWorldData();
    act(() => tree!.onDrop(rowKey('Warmth · After the AI'), rowKey('Warmth · Before the AI'), 0, new Set()));
    act(() => tree!.onDrop(rowKey('Warmth · After the AI'), 'timing:start', 0, new Set()));
    expect(bench.ctx().getWorldData()).toEqual(world);
    const notice = screen.getAllByRole('status').find((el) => el.textContent?.includes('stays in'));
    expect(notice).toHaveTextContent('Warmth · After the AI stays in After the AI. Change its timing with the Timing menu.');
  });

  it('edits the same script as the owner’s own Scripts tab, from either side', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    selectRow('Warmth · After the AI');
    fireEvent.change(codeBox('Warmth · After the AI'), { target: { value: 'return 5;' } });
    expect(bench.ctx().stats[0].scripts![0].code).toBe('return 5;');

    fireEvent.click(screen.getByRole('button', { name: /^Open Warmth/ }));
    await waitFor(() => expect(within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name: 'Scripts' }))
      .toHaveAttribute('aria-selected', 'true'));
    expect(codeBox('Warmth · After the AI').value).toBe('return 5;');
    fireEvent.change(codeBox('Warmth · After the AI'), { target: { value: 'return 6;' } });

    openScripts();
    selectRow('Warmth · After the AI');
    expect(codeBox('Warmth · After the AI').value).toBe('return 6;');
  });

  it('edits an entity’s own script where the entity keeps it', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    selectRow('Temper');
    fireEvent.change(codeBox('Temper'), { target: { value: 'owner.stats.Rage.value = 2;' } });
    expect(bench.ctx().entities[0].stats![0].scripts![0].code).toBe('owner.stats.Rage.value = 2;');
  });

  it('keeps an entity edit queued in the same tick as a script write on that entity', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    selectRow('Temper');
    act(() => {
      bench.ctx().editEntity('resident', (entity) => ({ ...entity, name: 'Odd Wick II' }));
      fireEvent.change(codeBox('Temper'), { target: { value: 'owner.stats.Rage.value = 2;' } });
    });
    expect(bench.ctx().entities[0].name).toBe('Odd Wick II');
    expect(bench.ctx().entities[0].stats![0].scripts![0].code).toBe('owner.stats.Rage.value = 2;');
  });

  it('undoes a typed run in the tab in one step', async () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    selectRow('World · After the AI');
    fireEvent.change(codeBox('World · After the AI'), { target: { value: 'stats.Warmth.value = 7;' } });
    // Keystrokes land in separate tasks, so only the key joins them into one Step.
    await act(() => new Promise((resolve) => { setTimeout(resolve, 0); }));
    fireEvent.change(codeBox('World · After the AI'), { target: { value: 'stats.Warmth.value = 8;' } });
    expect(bench.ctx().worldScripts[0].code).toBe('stats.Warmth.value = 8;');
    act(() => bench.history().undo());
    expect(bench.ctx().worldScripts[0].code).toBe('stats.Warmth.value = 2;');
  });

  it('adds a world script in the picked timing, named by the search text, and undoes the add', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    fireEvent.change(screen.getByPlaceholderText('Search scripts'), { target: { value: 'Opening Roll' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Script' }));
    fireEvent.click(screen.getByRole('button', { name: 'At Game Start' }));
    const added = bench.ctx().worldScripts[1];
    expect(added).toMatchObject({ timing: 'start', name: 'Opening Roll', code: '' });
    expect(codeBox('Opening Roll')).toBeInTheDocument();
    // With no search typed the tree stays mounted, and the group's row redraws with its new count.
    const group = (label: string) => screen.getAllByText(label).map((el) => el.closest('div.cursor-pointer')).find(Boolean);
    expect(group('After the AI')?.textContent).toBe('After the AI4');
    fireEvent.click(screen.getByRole('button', { name: 'Add Script' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'After the AI' }).find((el) => !el.closest('div.cursor-pointer'))!);
    expect(group('After the AI')?.textContent).toBe('After the AI5');
    act(() => bench.history().undo());

    act(() => bench.history().undo());
    expect(bench.ctx().worldScripts.map((s) => s.id)).toEqual(['weather']);
  });

  it('removes a script from the tab and drops the selection', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    selectRow('Brave · After the AI');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Script' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(bench.ctx().traits[0]).not.toHaveProperty('scripts');
    expect(screen.queryByRole('textbox', { name: 'Code Brave · After the AI' })).toBeNull();
  });

  it('dims the row of a disabled stat’s script until the stat is enabled', () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    const warmth = bench.ctx().stats[0];
    act(() => bench.ctx().updateStat({ ...warmth, enabled: false }));
    openScripts();
    const opacityOf = (label: string) => {
      const text = screen.getAllByText(label).find((el) => !el.closest('[role="group"]'))!;
      let row: HTMLElement | null = text;
      while (row && !row.style.opacity) row = row.parentElement;
      return row?.style.opacity;
    };
    expect(opacityOf('Warmth · After the AI')).toBe('0.5');
    expect(opacityOf('Warmth · Before the AI')).toBe('0.5');
    expect(opacityOf('World · After the AI')).toBe('1');
    // Each of the stat's two rows reads Off; no other row does.
    expect(screen.getAllByText('Off')).toHaveLength(2);

    act(() => bench.ctx().updateStat({ ...bench.ctx().stats[0], enabled: true }));
    expect(opacityOf('Warmth · After the AI')).toBe('1');
    expect(screen.queryByText('Off')).toBeNull();
  });

  it('runs each Blueprint box under the Owner the snapshot derives: the group’s stats, or a trait’s unchecked names', () => {
    renderWorldEditorBench(benchEditorWorld({
      statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }, { id: 'pack', name: 'Pack', parentId: 'bp' }],
      stats: [stat('howl', 'Howl', { groupId: 'pack', scripts: [{ id: 'h-after', timing: 'after', code: 'return 1;' }] }), stat('fang', 'Fang', { groupId: 'pack' })],
      traitGroups: [{ id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
      traits: [{ id: 'wild', name: 'Wild', groupId: 'tbp', statChanges: [], scripts: [{ id: 'wl-after', timing: 'after', code: 'return 0;' }] }],
    } as Partial<World>), 'advanced');
    openScripts();
    const ownerOf = (label: string) => {
      selectRow(label);
      return JSON.parse(codeBox(label).dataset.owner!) as unknown;
    };
    expect(ownerOf('Howl · After the AI')).toEqual({ kind: 'blueprint', statNames: ['Howl', 'Fang'] });
    expect(ownerOf('Wild · After the AI')).toEqual({ kind: 'blueprint', statNames: null });
  });

  it('is an Advanced tab', () => {
    renderWorldEditorBench(WORLD, 'simple');
    expect(within(screen.getByRole('tablist', { name: 'Editor Sections' })).queryByRole('tab', { name: /^Scripts/ })).toBeNull();
  });
});

type Ctx = ReturnType<ReturnType<typeof renderWorldEditorBench>['ctx']>;

describe('undo of an edit made on the Scripts tab', () => {
  /** One author action, then the event loop moves on as it does between two presses. */
  const step = (action: () => void) => act(async () => {
    action();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  const undo = async () => {
    await step(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'z', ctrlKey: true }); });
    await frames(2);
  };
  const ringed = () => {
    const rings = document.querySelectorAll<HTMLElement>(`.${LANDING_PULSE_CLASS}`);
    expect(rings).toHaveLength(1);
    return landingTarget(rings[0]);
  };

  /** Types into a script's box on the Scripts tab, then leaves for the Stats tab. */
  const editThenLeave = async (label: string, code: string) => {
    openScripts();
    selectRow(label);
    await step(() => codeBox(label).focus());
    await step(() => { fireEvent.change(codeBox(label), { target: { value: code } }); });
    await step(() => openEditorTab(/^Stats/));
  };

  it.each([
    ['a world script', 'World · After the AI', (ctx: Ctx) => ctx.worldScripts[0].code],
    ['a stat script', 'Warmth · After the AI', (ctx: Ctx) => ctx.stats[0].scripts![0].code],
    ['a trait script', 'Brave · After the AI', (ctx: Ctx) => ctx.traits[0].scripts![0].code],
  ])('returns to the Scripts tab with %s’s row and box, and pulses the box', async (_kind, label, codeOf) => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    const was = codeOf(bench.ctx());
    await editThenLeave(label, 'return 9;');

    await undo();
    expect(codeOf(bench.ctx())).toBe(was);
    expect(shownEditorTab()).toMatch(/^Scripts/);
    expect(codeBox(label).value).toBe(was);
    // The detail shows the box of the selected row alone.
    expect(ringed()).toContainElement(codeBox(label));
  });
});
