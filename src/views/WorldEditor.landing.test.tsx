import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { LANDING_PULSE_CLASS, LANDING_RING_CLASS } from '@/lib/landingPulse';
import { routeText, SURFACE_TARGETS } from '@/lib/surface/surfaceTargets';
import { stubReducedMotion } from '@/test/reducedMotion';

/** Take Me There landing in the World Editor: the control a request names is scrolled to, focused, and pulsed once. */

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

const WORLD = benchEditorWorld({});
const STATS_BAR = 'worldEditor.stats#list-toolbar';

const rowOf = (route: string) => document.querySelector<HTMLElement>(`[data-surface-target="${route}"]`);

/** Lets the landing's frames run out. */
const frames = (count: number) => act(async () => {
  for (let i = 0; i < count; i++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
});

let scrolled: Element[];
const realScroll = Element.prototype.scrollIntoView;
beforeEach(() => {
  localStorage.clear();
  scrolled = [];
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
});
afterEach(() => {
  Element.prototype.scrollIntoView = realScroll;
  vi.unstubAllGlobals();
});

/** The editor props a request for one registered target sends: its tab or its Bench instrument. */
function requestFor(surface: string, target: string) {
  const route = routeText(surface, target);
  const [ledger, tab] = surface.split('.');
  if (ledger === 'worldEditorBench') return { initialBenchTab: tab, initialTarget: route, requestKey: 'a' };
  return { initialTab: tab, initialTarget: route, requestKey: 'a' };
}

describe('World Editor Take Me There landing', () => {
  it.each(Object.entries(SURFACE_TARGETS).filter(([surface]) => surface.startsWith('worldEditor'))
    .flatMap(([surface, targets]) => targets.map((target) => [surface, target] as const)))(
    'lands %s#%s: scrolled to, then pulsed once',
    async (surface, target) => {
      renderWorldEditorBench(WORLD, 'advanced', requestFor(surface, target));
      const route = routeText(surface, target);
      await waitFor(() => expect(scrolled).toContain(rowOf(route)));
      expect(rowOf(route)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
      expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(1);
    },
  );

  it('focuses the search box when the request names a tab toolbar', async () => {
    renderWorldEditorBench(WORLD, 'advanced', requestFor('worldEditor.stats', 'list-toolbar'));
    await waitFor(() => expect(scrolled).toContain(rowOf(STATS_BAR)));
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search or add new stats'));
  });

  it('focuses the Find button when the request names it', async () => {
    renderWorldEditorBench(WORLD, 'advanced', requestFor('worldEditor', 'find-button'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Find and replace' })));
  });

  it('focuses the selected mode when the request names the mode switch', async () => {
    renderWorldEditorBench(WORLD, 'advanced', requestFor('worldEditor', 'editor-mode'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Advanced' })));
  });

  it('takes the pulse class off when the animation ends', async () => {
    renderWorldEditorBench(WORLD, 'advanced', requestFor('worldEditor.stats', 'list-toolbar'));
    await waitFor(() => expect(rowOf(STATS_BAR)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true));
    const row = rowOf(STATS_BAR)!;
    row.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: LANDING_PULSE_CLASS }));
    expect(row.classList.contains(LANDING_PULSE_CLASS)).toBe(false);
  });

  it('draws the still ring without the pulse under reduced motion', async () => {
    stubReducedMotion();
    renderWorldEditorBench(WORLD, 'advanced', requestFor('worldEditor.stats', 'list-toolbar'));
    await waitFor(() => expect(rowOf(STATS_BAR)!.classList.contains(LANDING_RING_CLASS)).toBe(true));
    expect(rowOf(STATS_BAR)!.classList.contains(LANDING_PULSE_CLASS)).toBe(false);
  });

  it('leaves the tab open with no error when the target is not on screen', async () => {
    const errors = vi.spyOn(console, 'error');
    // The Overview tab has no Stats toolbar, so the registered target is absent from the DOM.
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'overview', initialTarget: STATS_BAR, requestKey: 'a' });
    await screen.findByLabelText('World Name');
    await frames(32);
    expect(scrolled).toEqual([]);
    expect(document.querySelector(`.${LANDING_PULSE_CLASS}`)).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('waits for a tab that mounts after the request', async () => {
    const view = renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'overview' });
    await screen.findByLabelText('World Name');
    expect(rowOf(STATS_BAR)).toBeNull();
    // The Stats panel mounts a commit after the tab change the request makes.
    view.rerender({ initialTab: 'stats', initialTarget: STATS_BAR, requestKey: 'a' });
    await waitFor(() => expect(scrolled).toContain(rowOf(STATS_BAR)));
  });

  it('keeps looking for a row that mounts a few frames after the request', async () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'overview', initialTarget: STATS_BAR, requestKey: 'a' });
    await screen.findByLabelText('World Name');
    await frames(3);
    expect(scrolled).toEqual([]);
    openEditorTab(/Stats/);
    await waitFor(() => expect(scrolled).toContain(rowOf(STATS_BAR)));
  });

  it('lands again on a repeat request for the same target', async () => {
    const view = renderWorldEditorBench(WORLD, 'advanced', requestFor('worldEditor.stats', 'list-toolbar'));
    await waitFor(() => expect(scrolled).toHaveLength(1));
    const row = rowOf(STATS_BAR)!;
    row.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: LANDING_PULSE_CLASS }));
    view.rerender({ ...requestFor('worldEditor.stats', 'list-toolbar'), requestKey: 'b' });
    await waitFor(() => expect(scrolled).toHaveLength(2));
    expect(scrolled[1]).toBe(row);
    expect(row.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
  });
});
