// Storage is real (in-memory): SettingsProvider and the modal both read it on mount.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider } from '@/components/theme-provider';
import { LANDING_PULSE_CLASS, LANDING_RING_CLASS } from '@/lib/landingPulse';
import { resolveSurface } from '@/lib/surface/surfaceRoute';
import { routeText, SURFACE_TARGETS } from '@/lib/surface/surfaceTargets';
import { settingsLanding } from '@/lib/surface/useSurfaceOpenRequest';
import { stubReducedMotion } from '@/test/reducedMotion';
import { frames, recordScrolls, rowOf } from '@/test/landing';
import { SettingsModal } from './SettingsModal';
import { endpointTabForRoute } from './settingsTabs';

/** Take Me There landing in Settings: the row a request names is scrolled to, focused, and pulsed once. */

// The bundled-engine panel talks to Electron IPC, and the embedding model is a worker download. Neither
// runs in jsdom, and neither is what these tests are about.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/embeddingWorkerClient', () => ({
  loadEmbeddingModel: () => Promise.resolve(),
  disposeEmbeddingModel: () => {},
}));
const toasts = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock('react-toastify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-toastify')>();
  const record = (...args: unknown[]) => { toasts.calls.push(args); };
  return {
    ...actual,
    toast: Object.assign(record, { success: record, error: record, info: record, warn: record, warning: record, loading: record, dismiss: () => {} }),
  };
});

const LAYOUT = 'settings.display#narration-layout';

type Props = Partial<Parameters<typeof SettingsModal>[0]>;
const tree = (props: Props) => (
  <ThemeProvider>
    <SettingsProvider>
      <SettingsModal isOpen onOpenChange={() => {}} forcedMode="advanced" onStartAuthoringTour={() => {}} {...props} />
    </SettingsProvider>
  </ThemeProvider>
);

const scrolled = recordScrolls();
beforeEach(() => {
  toasts.calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Settings Take Me There landing', () => {
  it('scrolls the target row into view and focuses its control', async () => {
    render(tree({ initialTab: 'display', initialTarget: LAYOUT, requestKey: 'a' }));
    await waitFor(() => expect(scrolled).toContain(rowOf(LAYOUT)));
    const row = rowOf(LAYOUT)!;
    expect(row.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.getAttribute('role')).toMatch(/radio|combobox/);
  });

  it('pulses the row once, and the class leaves when the animation ends', async () => {
    render(tree({ initialTab: 'display', initialTarget: LAYOUT, requestKey: 'a' }));
    await waitFor(() => expect(rowOf(LAYOUT)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true));
    expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(1);
    const row = rowOf(LAYOUT)!;
    row.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: LANDING_PULSE_CLASS }));
    expect(row.classList.contains(LANDING_PULSE_CLASS)).toBe(false);
  });

  it('draws the still ring without the pulse under reduced motion', async () => {
    stubReducedMotion();
    render(tree({ initialTab: 'display', initialTarget: LAYOUT, requestKey: 'a' }));
    await waitFor(() => expect(rowOf(LAYOUT)!.classList.contains(LANDING_RING_CLASS)).toBe(true));
    expect(rowOf(LAYOUT)!.classList.contains(LANDING_PULSE_CLASS)).toBe(false);
  });

  it('leaves the tab open with no error and no toast when the target is not on screen', async () => {
    const errors = vi.spyOn(console, 'error');
    // The Output tab holds no Display row, so the registered target is absent from the DOM.
    render(tree({ initialTab: 'output', initialTarget: LAYOUT, requestKey: 'a' }));
    await frames(32);
    expect(screen.getByRole('tab', { name: 'Output' })).toHaveAttribute('aria-selected', 'true');
    expect(scrolled).toEqual([]);
    expect(document.querySelector(`.${LANDING_PULSE_CLASS}`)).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    expect(toasts.calls).toEqual([]);
  });

  it('lands again on a repeat request for the same target', async () => {
    const { rerender } = render(tree({ initialTab: 'display', initialTarget: LAYOUT, requestKey: 'a' }));
    await waitFor(() => expect(scrolled).toHaveLength(1));
    const row = rowOf(LAYOUT)!;
    row.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: LANDING_PULSE_CLASS }));
    rerender(tree({ initialTab: 'display', initialTarget: LAYOUT, requestKey: 'b' }));
    await waitFor(() => expect(scrolled).toHaveLength(2));
    expect(scrolled[1]).toBe(row);
    expect(row.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
  });

  // The endpoint list is disabled under a built-in preset, which every fresh install has active.
  const TAKES_NO_FOCUS = new Set(['settingsPromptSurfaces.options#prompt-endpoint']);
  const inSettings = Object.entries(SURFACE_TARGETS).flatMap(([surface, targets]) => targets
    .filter((target) => resolveSurface(surface, target)?.dialog === 'settings')
    .map((target) => [surface, target] as const));

  it.each(inSettings)('lands %s#%s on its row', async (surface, target) => {
    const route = routeText(surface, target);
    // The props a request gives the modal, as the game screen and the main menu derive them.
    const landing = settingsLanding(resolveSurface(surface, target)!);
    render(tree({
      initialTab: landing.tab,
      initialEndpointTab: landing.endpointTab,
      initialPromptTab: landing.promptTab,
      initialPromptSurface: landing.promptSurface,
      initialTarget: route,
      requestKey: 'a',
    }));
    await waitFor(() => expect(scrolled).toContain(rowOf(route)));
    expect(rowOf(route)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
    if (!TAKES_NO_FOCUS.has(route)) expect(rowOf(route)!.contains(document.activeElement)).toBe(true);
  });

  it.each(SURFACE_TARGETS['settingsEndpoints.text'])('lands settingsEndpoints.text#%s on its row and control', async (target) => {
    const route = routeText('settingsEndpoints.text', target);
    render(tree({ initialTab: 'endpoints', initialEndpointTab: endpointTabForRoute('text'), initialTarget: route, requestKey: 'a' }));
    await waitFor(() => expect(scrolled).toContain(rowOf(route)));
    expect(rowOf(route)!.contains(document.activeElement)).toBe(true);
    expect(rowOf(route)!.classList.contains(LANDING_PULSE_CLASS)).toBe(true);
  });

  it('waits for a tab panel that mounts after the request', async () => {
    const { rerender } = render(tree({ initialTab: 'output' }));
    await frames(2);
    expect(rowOf(LAYOUT)).toBeNull();
    // The Display panel mounts a commit after the tab change the request makes.
    rerender(tree({ initialTab: 'display', initialTarget: LAYOUT, requestKey: 'a' }));
    await waitFor(() => expect(scrolled).toContain(rowOf(LAYOUT)));
  });
});
