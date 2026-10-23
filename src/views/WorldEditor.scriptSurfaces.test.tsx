import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { Script, World } from '@/types';

/**
 * One script edited from each surface that draws its row: the stat panel's Scripts tab, the trait panel's, and the
 * editor-wide Scripts tab. Each edit lands on the stored script as the one field it changed, and nothing else.
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

// The real editor arrives on its own chunk with CodeMirror; a plain box that writes back stands in.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; ariaLabel: string; onChange: (value: string) => void }) => (
    <textarea aria-label={props.ariaLabel} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
  ),
}));

const stat = (id: string, name: string, extra: object = {}) =>
  ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra });

const WORLD: World = benchEditorWorld({
  scripts: [{ id: 'weather', timing: 'after', code: 'return 2;' }, { id: 'tide', timing: 'before', code: 'return 3;' }],
  entities: [{
    id: 'resident', name: 'Odd Wick', locations: ['harbor'],
    stats: [stat('rage', 'Rage', { scripts: [{ id: 'r-after', timing: 'after', code: 'return 1;' }] })],
  }],
  stats: [
    stat('warmth', 'Warmth', {
      scripts: [{ id: 'w-after', timing: 'after', code: 'return 4;' }, { id: 'w-before', timing: 'before', code: 'return 1;' }],
    }),
  ],
  traits: [{ id: 'brave', name: 'Brave', statChanges: [], scripts: [{ id: 'b-after', timing: 'after', code: 'return 0;', order: 1 }] }],
} as Partial<World>);

type Ctx = ReturnType<ReturnType<typeof renderWorldEditorBench>['ctx']>;

interface Surface {
  open: () => void;
  label: string;
  scriptId: string;
  list: (ctx: Ctx) => readonly Script[];
}

const openPanel = (tab: RegExp, item: string, strip: string) => {
  openEditorTab(tab);
  fireEvent.click(screen.getByText(item));
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: strip })).getByRole('tab', { name: 'Scripts' }));
};
const openScriptsTab = (label: string) => {
  openEditorTab(/^Scripts/);
  fireEvent.click(screen.getAllByText(label).find((el) => !el.closest('[role="group"]'))!);
};
const statScripts = (ctx: Ctx) => ctx.stats[0].scripts ?? [];
const traitScripts = (ctx: Ctx) => ctx.traits[0].scripts ?? [];

const SURFACES: [string, Surface][] = [
  ['the stat panel', { open: () => openPanel(/^Stats/, 'Warmth', 'Stat Fields'), label: 'Warmth · After the AI', scriptId: 'w-after', list: statScripts }],
  ['the trait panel', { open: () => openPanel(/^Traits/, 'Brave', 'Trait Fields'), label: 'Brave · After the AI', scriptId: 'b-after', list: traitScripts }],
  ['the Scripts tab on a stat', { open: () => openScriptsTab('Warmth · After the AI'), label: 'Warmth · After the AI', scriptId: 'w-after', list: statScripts }],
  ['the Scripts tab on a trait', { open: () => openScriptsTab('Brave · After the AI'), label: 'Brave · After the AI', scriptId: 'b-after', list: traitScripts }],
  ['the Scripts tab on an entity stat', {
    open: () => openScriptsTab('Rage · After the AI'), label: 'Rage · After the AI', scriptId: 'r-after',
    list: (ctx) => ctx.entities[0].stats![0].scripts ?? [],
  }],
  ['the Scripts tab on a world script', {
    open: () => openScriptsTab('World · After the AI'), label: 'World · After the AI', scriptId: 'weather', list: (ctx) => ctx.worldScripts,
  }],
];

const stored = (surface: Surface, ctx: Ctx) => surface.list(ctx).find((script) => script.id === surface.scriptId);
const row = (label: string) => screen.getByRole('group', { name: label });

beforeEach(() => { localStorage.clear(); });

describe.each(SURFACES)('a script edited from %s', (_where, surface) => {
  const start = () => {
    const bench = renderWorldEditorBench(WORLD, 'advanced');
    surface.open();
    return { bench, before: stored(surface, bench.ctx())! };
  };

  it('stores typed code as the one changed field', () => {
    const { bench, before } = start();
    fireEvent.change(screen.getByRole('textbox', { name: `Code ${surface.label}` }), { target: { value: 'return 5;' } });
    expect(stored(surface, bench.ctx())).toStrictEqual({ ...before, code: 'return 5;' });
  });

  it('keeps the script’s size within the typed text through a fast run of keystrokes', () => {
    const { bench, before } = start();
    let code = before.code;
    // Kept short: a write that nests the script in itself doubles its size per keystroke.
    for (let i = 0; i < 12; i++) {
      code += 'x';
      fireEvent.change(screen.getByRole('textbox', { name: `Code ${surface.label}` }), { target: { value: code } });
    }
    const after = stored(surface, bench.ctx())!;
    expect(JSON.stringify(after).length).toBeLessThanOrEqual(JSON.stringify(before).length + 12);
    expect(after).toStrictEqual({ ...before, code });
  });

  it('stores a typed name and drops a cleared one', () => {
    const { bench, before } = start();
    fireEvent.change(within(row(surface.label)).getByRole('textbox', { name: 'Name' }), { target: { value: 'Drain' } });
    expect(stored(surface, bench.ctx())).toStrictEqual({ ...before, name: 'Drain' });
    fireEvent.change(within(row('Drain')).getByRole('textbox', { name: 'Name' }), { target: { value: '' } });
    expect(stored(surface, bench.ctx())).toStrictEqual(before);
  });

  it('stores a Timing change as the one changed field', () => {
    const { bench, before } = start();
    // Picked by keyboard: a click needs pointer capture, which jsdom lacks.
    fireEvent.keyDown(within(row(surface.label)).getByRole('combobox', { name: 'Timing' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('option', { name: 'At Game Start' }), { key: 'Enter' });
    expect(stored(surface, bench.ctx())).toStrictEqual({ ...before, timing: 'start' });
  });

  it('removes the script after the confirm and leaves the rest of its home', () => {
    const { bench } = start();
    const others = surface.list(bench.ctx()).filter((script) => script.id !== surface.scriptId);
    fireEvent.click(within(row(surface.label)).getByRole('button', { name: 'Remove Script' }));
    expect(stored(surface, bench.ctx())).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(surface.list(bench.ctx())).toStrictEqual(others);
  });
});

/** Ash links the Blueprint stat Trust and overrides its scripts, so the Scripts tab lists the link's own row. */
const LINKED: World = benchEditorWorld({
  stats: [stat('bp-trust', 'Trust', { groupId: 'bp', value: 5 })],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, order: 1, system: 'blueprints' }],
  entities: [{
    id: 'ash', name: 'Ash', locations: ['harbor'],
    statLinks: [{
      id: 'l-trust', originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null,
      overrides: { 'bp-trust': { scripts: { value: [{ id: 't-after', timing: 'after', code: '' }], blueprint: [] } } },
    }],
  }],
} as Partial<World>);

const TRUST_BOX = 'Trust · After the AI';

describe.each([
  ['the stat panel', () => {
    openEditorTab(/^Entities/);
    fireEvent.click(screen.getAllByText('Ash')[0]);
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Entity Fields' })).getByRole('tab', { name: 'Stats' }));
    fireEvent.click(screen.getAllByText('Trust').find((el) => !el.closest('[role="group"]'))!);
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name: 'Scripts' }));
  }],
  ['the Scripts tab', () => openScriptsTab(TRUST_BOX)],
])('Test Code on a root-linked stat from %s', (_where, open) => {
  it('reports a write through owner.stats to the stat itself, as play runs it', async () => {
    renderWorldEditorBench(LINKED, 'advanced');
    open();
    fireEvent.change(screen.getByRole('textbox', { name: `Code ${TRUST_BOX}` }), { target: { value: 'owner.stats.Trust.value = 7;' } });
    fireEvent.click(screen.getByRole('button', { name: `Test Code ${TRUST_BOX}` }));
    const report = within(screen.getByRole('group', { name: TRUST_BOX }));
    expect(await report.findByText('Result: 7')).toBeInTheDocument();
    expect(report.queryByText(/did nothing/)).toBeNull();
  });
});
