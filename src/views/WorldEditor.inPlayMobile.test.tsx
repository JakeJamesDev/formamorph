import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  asMobile, benchEditorWorld, clickOpenBench, finishSheetExit, renderWorldEditorBench,
} from '@/test/worldEditorBench';
import { resetTutorials } from '@/lib/tutorials';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import type { World } from '@/types';

/**
 * In Play on mobile, driven through the real editor: Show Effect on the step note opens the desktop pane's slice
 * in a bottom sheet. The note hides while the sheet is open, and the sheet is never open with the Bench's sheet.
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

// jsdom has no Worker: the measure answers with the real byte count, off a promise like the worker's.
vi.mock('@/lib/jsonMeasureClient', async () => {
  const { measurePublishBytes } = await import('@/lib/publishLimits');
  return {
    measureJsonBytes: async (value: unknown) => measurePublishBytes(value),
    terminateMeasureWorker: vi.fn(),
  };
});

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

// Cast: the overview type requires fields that a New World overview does not have.
const NEW_WORLD = benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
} as unknown as Partial<World>);

const startTour = async () => {
  renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
  const offer = await screen.findByRole('dialog', { name: 'Take the Authoring Tour?' }, { timeout: 2000 });
  fireEvent.click(within(offer).getByRole('button', { name: 'Start Tour' }));
  return screen.findByRole('dialog', { name: 'World Name' });
};

/** From World Name to the AI-Facing Description step, past the one-time Save note. */
const toAiDescription = async () => {
  fireEvent.click(within(screen.getByRole('dialog', { name: 'World Name' })).getByRole('button', { name: 'Use Example' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'World Name' })).getByRole('button', { name: 'Next' }));
  const step = () => screen.queryByRole('dialog', { name: 'AI-Facing Description' });
  const saved = () => screen.queryByRole('dialog', { name: 'Your World Is Saved' });
  await waitFor(() => expect(step() ?? saved()).not.toBeNull());
  const note = saved();
  if (note) fireEvent.click(within(note).getByRole('button', { name: 'Got It' }));
  return screen.findByRole('dialog', { name: 'AI-Facing Description' });
};

const showEffect = (note: HTMLElement) => within(note).queryByRole('button', { name: 'Show Effect' });
/** Matched by its title element: its accessible name is empty under another sheet's `aria-hidden`. */
const effectSheet = () => screen.queryAllByRole('dialog', { hidden: true }).find(
  (d) => document.getElementById(d.getAttribute('aria-labelledby') ?? '')?.textContent === 'In Play',
) ?? null;
const benchSheet = () => screen.getByRole('dialog', { name: 'Test Bench' });
const inPlay = () => within(effectSheet()!).getByRole('region', { name: 'In Play' });
const playerSees = () => within(inPlay()).getByRole('region', { name: 'Player Sees' });
const narration = () => within(inPlay()).getByRole('region', { name: 'Narration Prompt Reads' });
const marks = (el: HTMLElement) => Array.from(el.querySelectorAll('mark')).map((m) => m.textContent);
const dockedInPlay = () => document.querySelector('[data-panel-id="editor-inplay"]');

let restoreViewport = () => {};

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  reloadTourProgress();
  vi.clearAllMocks();
});

afterEach(() => {
  restoreViewport();
  restoreViewport = () => {};
});

describe('In Play on mobile', () => {
  it('offers Show Effect in place of the docked pane', async () => {
    restoreViewport = asMobile();
    const note = await startTour();
    expect(showEffect(note)).not.toBeNull();
    expect(dockedInPlay()).toBeNull();
    expect(effectSheet()).toBeNull();
  });

  it('opens the same slice as the desktop pane, marked, and live as the author types', async () => {
    restoreViewport = asMobile();
    await startTour();
    const note = await toAiDescription();
    fireEvent.click(within(note).getByRole('button', { name: 'Use Example' }));
    fireEvent.click(showEffect(note)!);

    await waitFor(() => expect(effectSheet()).toHaveAttribute('data-state', 'open'));
    expect(within(playerSees()).getByText('Players never see the AI-Facing Description')).toBeInTheDocument();
    const [marked] = marks(narration());
    expect(marked).toMatch(/^Brinewell is a quiet fishing village/);
  });

  it('hides the note while the sheet is open, and shows it and focuses the field after it closes', async () => {
    restoreViewport = asMobile();
    // A tap focuses the button, and the button unmounts with the note. fireEvent alone does not move focus.
    const button = showEffect(await startTour())!;
    button.focus();
    fireEvent.click(button);
    await waitFor(() => expect(effectSheet()).toHaveAttribute('data-state', 'open'));
    expect(screen.queryByRole('dialog', { name: 'World Name' })).toBeNull();

    fireEvent.keyDown(effectSheet()!, { key: 'Escape' });
    await waitFor(() => expect(effectSheet()).toHaveAttribute('data-state', 'closed'));
    finishSheetExit(effectSheet()!);
    expect(effectSheet()).toBeNull();
    expect(await screen.findByRole('dialog', { name: 'World Name' })).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('worldName')));
  });

  it('updates the open sheet as the world changes', async () => {
    restoreViewport = asMobile();
    fireEvent.click(showEffect(await startTour())!);
    await waitFor(() => expect(effectSheet()).toHaveAttribute('data-state', 'open'));
    expect(within(playerSees()).getByRole('heading', { name: 'New World' })).toBeInTheDocument();

    const field = document.getElementById('worldName') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'Brinewell' } });
    expect(within(playerSees()).getByRole('heading', { name: 'Brinewell' })).toBeInTheDocument();
  });

  it('hides Show Effect while the Bench sheet is open', async () => {
    restoreViewport = asMobile();
    await startTour();
    await clickOpenBench();
    await waitFor(() => expect(benchSheet()).toHaveAttribute('data-state', 'open'));
    expect(screen.queryByRole('button', { name: 'Show Effect' })).toBeNull();
    expect(effectSheet()).toBeNull();
  });

  it('hides the flask, and closes when the Bench sheet opens', async () => {
    restoreViewport = asMobile();
    fireEvent.click(showEffect(await startTour())!);
    await waitFor(() => expect(effectSheet()).toHaveAttribute('data-state', 'open'));
    expect(screen.queryByRole('button', { name: /^Test Bench/ })).toBeNull();

    // Clicks through `aria-hidden`, as the dev router's `bench=` opens the Bench without a click.
    fireEvent.click(screen.getByRole('button', { name: /^Test Bench/, hidden: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Test Bench', hidden: true }));
    await waitFor(() => expect(benchSheet()).toHaveAttribute('data-state', 'open'));
    expect(effectSheet()).toHaveAttribute('data-state', 'closed');
  });
});

describe('In Play on desktop', () => {
  it('docks the pane and offers no Show Effect', async () => {
    const note = await startTour();
    expect(dockedInPlay()).not.toBeNull();
    expect(showEffect(note)).toBeNull();
    expect(effectSheet()).toBeNull();
  });
});
