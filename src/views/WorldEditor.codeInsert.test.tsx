import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { onStatCodeInsert, statCodeInsertTarget } from '@/lib/formaquestion/statCodeInsert';
import { LANDING_PULSE_CLASS } from '@/lib/landingPulse';
import type { World } from '@/types';

/** The stat panel's side of the help window's Insert: the registration, the draft write, the confirm, and the landing. */

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
  CodeArea: (props: { value: string; ariaLabel: string }) => <textarea aria-label={props.ariaLabel} value={props.value} readOnly />,
}));

const WORLD: World = benchEditorWorld({
  stats: [
    { id: 's1', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, code: 'return 4;', descriptors: [] },
  ],
} as Partial<World>);

const BEFORE_BOX = 'worldEditorStat.code#before-code';
const AFTER_BOX = 'worldEditorStat.code#after-code';
const boxOf = (route: string) => document.querySelector<HTMLElement>(`[data-surface-target="${route}"]`);

const selectStat = (name: string) => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Stats/ }));
  fireEvent.click(screen.getByText(name));
};
const panelTab = (name: string) => within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name });
const warmth = (ctx: () => { stats: World['stats'] }) => ctx().stats.find((stat) => stat.id === 's1')!;
const insert = (timing: 'before' | 'after', code: string) => act(() => statCodeInsertTarget()!.insert(timing, code));

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
    expect(statCodeInsertTarget()).toBeNull();
    selectStat('Warmth');
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(statCodeInsertTarget()?.statName).toBe('Warmth');
  });

  it('writes an empty box at once, opens the Code tab, and lands on the box with the pulse', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    insert('before', 'self.value = 2;');

    expect(warmth(ctx).beforeCode).toBe('self.value = 2;');
    expect(panelTab('Code')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(scrolled).toContain(boxOf(BEFORE_BOX)));
    expect(boxOf(BEFORE_BOX)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Stat Code Before the AI' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('asks before it replaces a box that has code, and writes on Confirm', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    insert('after', 'return 9;');

    const confirm = await screen.findByRole('alertdialog', { name: 'Replace The Existing Code' });
    expect(confirm).toHaveTextContent('This box already has code. Inserting this code overwrites it.');
    expect(warmth(ctx).code).toBe('return 4;');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Confirm' }));

    expect(warmth(ctx).code).toBe('return 9;');
    await waitFor(() => expect(scrolled).toContain(boxOf(AFTER_BOX)));
  });

  it('leaves the box as it was on Cancel', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    insert('after', 'return 9;');

    const confirm = await screen.findByRole('alertdialog', { name: 'Replace The Existing Code' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(warmth(ctx).code).toBe('return 4;');
    expect(scrolled).toEqual([]);
  });

  it('reports each step, so the help window can step aside', async () => {
    const events: string[] = [];
    const stop = onStatCodeInsert((event) => events.push(event));
    const { unmount } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');

    insert('before', 'self.value = 2;');
    expect(events).toEqual(['written']);

    insert('after', 'return 9;');
    await screen.findByRole('alertdialog', { name: 'Replace The Existing Code' });
    expect(events).toEqual(['written', 'confirming']);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(events).toEqual(['written', 'confirming', 'settled']);

    // A panel that closes under its open confirm settles it too.
    insert('after', 'return 9;');
    await screen.findByRole('alertdialog', { name: 'Replace The Existing Code' });
    unmount();
    expect(events).toEqual(['written', 'confirming', 'settled', 'confirming', 'settled']);
    stop();
  });

  it('writes the draft, so Discard takes the insert back', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    insert('before', 'self.value = 2;');
    await waitFor(() => expect(ctx().isWorldDirty).toBe(true));

    act(() => ctx().discardChanges());

    await waitFor(() => expect(warmth(ctx).beforeCode ?? '').toBe(''));
  });

  it('unregisters when the stat panel closes', () => {
    const { unmount } = renderWorldEditorBench(WORLD, 'advanced');
    selectStat('Warmth');
    expect(statCodeInsertTarget()).not.toBeNull();
    unmount();
    expect(statCodeInsertTarget()).toBeNull();
  });

  it('registers nothing in Simple mode, which has no Code tab', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectStat('Warmth');
    expect(statCodeInsertTarget()).toBeNull();
  });
});
