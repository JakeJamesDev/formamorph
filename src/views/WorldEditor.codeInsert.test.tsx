import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, openTraitFieldsTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { onScriptInsert, scriptInsertTarget } from '@/lib/formaquestion/scriptInsert';
import { LANDING_PULSE_CLASS } from '@/lib/landingPulse';
import { ringOn } from '@/test/landing';
import type { Script, ScriptTiming, World } from '@/types';
import { boxScripts, codeAt } from '@/test/scriptFixtures';

/** The stat panel's and the trait panel's side of the help window's Insert: the registration, the draft write, the confirm, and the landing. */

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

// CodeMirror arrives on its own chunk; a plain field on the same value stands in for it.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; ariaLabel: string; autoFocus?: boolean }) => (
    // Stands in for the editor's own focus once it loads.
    <textarea aria-label={props.ariaLabel} value={props.value} readOnly autoFocus={props.autoFocus} />
  ),
}));

const WORLD: World = benchEditorWorld({
  stats: [
    { id: 's1', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, scripts: boxScripts({ after: 'return 4;' }), descriptors: [] },
  ],
  traits: [
    { id: 't1', name: 'Bold', statChanges: [], scripts: boxScripts({ after: 'return 4;' }) },
  ],
} as Partial<World>);

/** The row of the script the last insert added. */
const addedRow = (ctx: () => { stats: World['stats'] }) =>
  document.querySelector<HTMLElement>(`[data-script-id="${warmth(ctx).scripts!.at(-1)!.id}"]`);

const selectStat = (name: string) => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Stats/ }));
  fireEvent.click(screen.getByText(name));
};
const panelTab = (name: string) => within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name });
function warmth(ctx: () => { stats: World['stats'] }) {
  return ctx().stats.find((stat) => stat.id === 's1')!;
}
const insert = (timing: ScriptTiming, code: string) => act(() => scriptInsertTarget()!.insert(timing, code));

let scrolled: Element[];
const realScroll = Element.prototype.scrollIntoView;
beforeEach(() => {
  localStorage.clear();
  scrolled = [];
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
});
afterEach(() => {
  Element.prototype.scrollIntoView = realScroll;
});

describe('inserting help code into the open stat', () => {
  it('registers the open stat by name, on any of its tabs', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    expect(scriptInsertTarget()).toBeNull();
    selectStat('Warmth');
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(scriptInsertTarget()?.homeName).toBe('Warmth');
  });

  it.each([
    ['output', 'Code Warmth · During AI Output'],
    ['start', 'Code Warmth · At Game Start'],
    ['switch', 'Code Warmth · When a Trait Switches'],
  ] as const)('writes a %s script and lands on it', async (timing, label) => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    insert(timing, 'return 5;');

    expect(warmth(ctx).scripts?.at(-1)).toMatchObject({ timing, code: 'return 5;' });
    expect(panelTab('Scripts')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(scrolled).toContain(addedRow(ctx)));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: label }));
  });

  it('writes a new script of its timing at once, opens the Scripts tab, and lands on it with the pulse', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    insert('before', 'self.value = 2;');

    expect(codeAt(warmth(ctx), 'before')).toBe('self.value = 2;');
    expect(panelTab('Scripts')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(scrolled).toContain(addedRow(ctx)));
    expect(ringOn(addedRow(ctx), LANDING_PULSE_CLASS)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Code Warmth · Before the AI' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('adds a script beside one that holds code, overwriting nothing and asking nothing', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    insert('after', 'return 9;');

    expect(warmth(ctx).scripts?.map((script) => [script.timing, script.code])).toEqual([['after', 'return 4;'], ['after', 'return 9;']]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(scrolled).toContain(addedRow(ctx)));
  });

  it('reports each insert as written, so the help window steps aside for none', () => {
    const events: string[] = [];
    const stop = onScriptInsert((event) => events.push(event));
    renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');

    insert('before', 'self.value = 2;');
    insert('after', 'return 9;');
    expect(events).toEqual(['written', 'written']);
    stop();
  });

  it('writes the draft, so Discard takes the insert back', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    insert('before', 'self.value = 2;');
    await waitFor(() => expect(ctx().isWorldDirty).toBe(true));

    act(() => ctx().discardChanges());

    await waitFor(() => expect(codeAt(warmth(ctx), 'before') ?? '').toBe(''));
  });

  it('unregisters when the stat panel closes', () => {
    const { unmount } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    expect(scriptInsertTarget()).not.toBeNull();
    unmount();
    expect(scriptInsertTarget()).toBeNull();
  });

  it('registers nothing in Simple mode, which has no Scripts tab', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectStat('Warmth');
    expect(scriptInsertTarget()).toBeNull();
  });
});

describe('inserting help code into the open trait', () => {
  const bold = (ctx: () => { traits: World['traits'] }) => ctx().traits.find((trait) => trait.id === 't1')!;
  const selectTrait = () => {
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Traits/ }));
    fireEvent.click(screen.getByText('Bold'));
  };
  const addedTraitRow = (ctx: () => { traits: World['traits'] }) =>
    document.querySelector<HTMLElement>(`[data-script-id="${bold(ctx).scripts!.at(-1)!.id}"]`);

  it('registers the trait by name only while its Scripts tab is shown', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait();
    expect(scriptInsertTarget()).toBeNull();
    openTraitFieldsTab('Scripts');
    expect(scriptInsertTarget()?.homeName).toBe('Bold');
    openTraitFieldsTab('Details');
    expect(scriptInsertTarget()).toBeNull();
  });

  it.each([
    ['start', 'Code Bold · At Game Start'],
    ['switch', 'Code Bold · When a Trait Switches'],
    ['before', 'Code Bold · Before the AI'],
  ] as const)('writes a %s script into the trait and lands on it', async (timing, label) => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectTrait();
    openTraitFieldsTab('Scripts');
    insert(timing, 'return 5;');

    expect(bold(ctx).scripts?.at(-1)).toMatchObject({ timing, code: 'return 5;' });
    await waitFor(() => expect(scrolled).toContain(addedTraitRow(ctx)));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: label }));
  });

  it('adds a script beside the ones the trait holds, asks nothing, and reports it written', () => {
    const events: string[] = [];
    const stop = onScriptInsert((event) => events.push(event));
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectTrait();
    openTraitFieldsTab('Scripts');
    insert('after', 'return 9;');

    expect(bold(ctx).scripts?.map((script) => [script.timing, script.code])).toEqual([['after', 'return 4;'], ['after', 'return 9;']]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(events).toEqual(['written']);
    stop();
  });

  it('unregisters when the trait panel closes', () => {
    const { unmount } = renderWorldEditorBench(WORLD, 'advanced');
    selectTrait();
    openTraitFieldsTab('Scripts');
    expect(scriptInsertTarget()).not.toBeNull();
    unmount();
    expect(scriptInsertTarget()).toBeNull();
  });
});

describe('inserting help code into the world', () => {
  const openScripts = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /^Scripts/ }));
  const added = (ctx: () => { worldScripts: Script[] }) => ctx().worldScripts.at(-1)!;

  it('registers the world only while its Scripts tab is shown', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    expect(scriptInsertTarget()).toBeNull();
    openScripts();
    expect(scriptInsertTarget()?.homeName).toBe('World Scripts');
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Stats/ }));
    expect(scriptInsertTarget()).toBeNull();
  });

  it.each([
    ['start', 'At Game Start'],
    ['switch', 'When a Trait Switches'],
    ['output', 'During AI Output'],
  ] as const)('writes a %s world script and lands on it', async (timing, label) => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    insert(timing, 'return 5;');

    expect(added(ctx)).toMatchObject({ timing, code: 'return 5;' });
    const box = await screen.findByRole('textbox', { name: new RegExp(`^Code .*${label}$`) });
    expect(box).toHaveValue('return 5;');
    expect(box).toBe(document.activeElement);
  });

  it('adds beside the world scripts it holds and reports it written', () => {
    const events: string[] = [];
    const stop = onScriptInsert((event) => events.push(event));
    const { ctx } = renderWorldEditorBench({ ...WORLD, scripts: [{ id: 'w1', timing: 'after', code: 'return 1;' }] }, 'advanced');
    openScripts();
    insert('after', 'return 9;');

    expect(ctx().worldScripts.map((script) => script.code)).toEqual(['return 1;', 'return 9;']);
    expect(events).toEqual(['written']);
    stop();
  });

  it('unregisters when the editor closes', () => {
    const { unmount } = renderWorldEditorBench(WORLD, 'advanced');
    openScripts();
    expect(scriptInsertTarget()).not.toBeNull();
    unmount();
    expect(scriptInsertTarget()).toBeNull();
  });
});
