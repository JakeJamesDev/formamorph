import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTHORING_TOUR_OFFER_ID, markTutorialSeen, resetTutorials, TUTORIAL_APPEAR_DELAY_MS } from '@/lib/tutorials';
import { readTourRecord, reloadTourProgress, writeTourRecord } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import { readEditorMode } from '@/lib/editorMode';
import WorldStorageService from '../services/WorldStorageService';
import type { World } from '@/types';

/**
 * The Authoring Tour's ending, driven through the real editor: the one-time note on Save, the mode step,
 * and the final step with Finish and Play.
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

const storeWorld = vi.mocked(WorldStorageService.storeWorld);
const getWorldMetadata = vi.mocked(WorldStorageService.getWorldMetadata);

const NEW_WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
} as unknown as Partial<World>);

const TOTAL = TOUR_STEPS.length;
const SAVE_NOTE = 'Your World Is Saved';
const MODE_STEP = 'More Fields in Advanced';
const PLAY_STEP = 'Play Your World';

const note = (title: string) => screen.getByRole('dialog', { name: title });
const tourBar = () => screen.queryByRole('region', { name: 'Authoring Tour' });
const saveButton = () => screen.getByRole('button', { name: 'Save' });

/** Waits out the tutorial layer's appear delay, so a note that was going to show has had its chance. */
const pastAppearDelay = () => act(() => new Promise((r) => { setTimeout(r, TUTORIAL_APPEAR_DELAY_MS + 200); }));

/** Opens the editor on a world whose tour stopped at `stepId`, the way a returning author finds it. */
const resumeAt = (stepId: string, mode: 'simple' | 'advanced' = 'simple', props = {}) => {
  // Taking the tour retired its offer.
  markTutorialSeen(AUTHORING_TOUR_OFFER_ID);
  writeTourRecord(NEW_WORLD.id, { step: stepId, items: {} });
  return renderWorldEditorBench(NEW_WORLD, mode, props);
};

const startTour = async () => {
  renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
  const offer = await screen.findByRole('dialog', { name: 'Take the Authoring Tour?' }, { timeout: 2000 });
  fireEvent.click(within(offer).getByRole('button', { name: 'Start Tour' }));
  await screen.findByRole('dialog', { name: TOUR_STEPS[0].title });
};

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  reloadTourProgress();
  vi.clearAllMocks();
  getWorldMetadata.mockResolvedValue([]);
});

describe('Authoring Tour Save note', () => {
  it('points at Save after the first save, then gives the step back', async () => {
    await startTour();
    expect(screen.queryByRole('dialog', { name: SAVE_NOTE })).not.toBeInTheDocument();
    fireEvent.click(within(note(TOUR_STEPS[0].title)).getByRole('button', { name: 'Next' }));

    const saveNote = await screen.findByRole('dialog', { name: SAVE_NOTE });
    expect(storeWorld).toHaveBeenCalledTimes(1);
    expect(saveButton()).toHaveAttribute('data-tour-anchor', 'save');
    // It is no step of its own: the tour stands at step 2 behind it, and the step note waits.
    expect(within(tourBar()!).getByText(`Authoring Tour · 2 / ${TOTAL}`)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: TOUR_STEPS[1].title })).not.toBeInTheDocument();

    fireEvent.click(within(saveNote).getByRole('button', { name: 'Got It' }));
    expect(screen.queryByRole('dialog', { name: SAVE_NOTE })).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: TOUR_STEPS[1].title })).toBeInTheDocument();
  });

  it('shows once', async () => {
    await startTour();
    fireEvent.click(within(note(TOUR_STEPS[0].title)).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: SAVE_NOTE })).getByRole('button', { name: 'Got It' }));

    // A later save on the same tour, then a save on a tour opened afresh.
    fireEvent.click(within(await screen.findByRole('dialog', { name: TOUR_STEPS[1].title }))
      .getByRole('button', { name: 'Use Example' }));
    fireEvent.click(within(note(TOUR_STEPS[1].title)).getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: TOUR_STEPS[2].title });
    expect(storeWorld).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog', { name: SAVE_NOTE })).not.toBeInTheDocument();
  });
});

describe('Authoring Tour mode step', () => {
  it('points at the mode switch and says Advanced shows more fields', async () => {
    resumeAt('editor-mode');
    const step = await screen.findByRole('dialog', { name: MODE_STEP });
    expect(step).toHaveTextContent('Advanced shows more fields');
    expect(within(step).getByText(`${TOTAL - 1} / ${TOTAL}`)).toBeInTheDocument();
    // Nothing to fill in, so no example and Next is open.
    expect(within(step).queryByRole('button', { name: 'Use Example' })).not.toBeInTheDocument();
    expect(within(step).getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(document.querySelector('[data-tour-anchor="editor-mode"]'))
      .toContainElement(document.querySelector<HTMLElement>('[aria-label="Editor mode"]'));
  });

  it('retires the one-time Simple vs. Advanced note', async () => {
    const touring = resumeAt('editor-mode');
    await screen.findByRole('dialog', { name: MODE_STEP });
    fireEvent.click(within(tourBar()!).getByRole('button', { name: 'End Tour' }));
    touring.unmount();

    renderWorldEditorBench(NEW_WORLD, 'simple');
    await pastAppearDelay();
    expect(screen.queryByRole('dialog', { name: 'Simple vs. Advanced' })).not.toBeInTheDocument();
  });

  it('leaves the Simple vs. Advanced note for an author who ended the tour before it', async () => {
    const touring = resumeAt(TOUR_STEPS[0].id);
    await screen.findByRole('dialog', { name: TOUR_STEPS[0].title });
    fireEvent.click(within(tourBar()!).getByRole('button', { name: 'End Tour' }));
    touring.unmount();

    renderWorldEditorBench(NEW_WORLD, 'simple');
    expect(await screen.findByRole('dialog', { name: 'Simple vs. Advanced' }, { timeout: 2000 })).toBeInTheDocument();
  });
});

describe('Authoring Tour final step', () => {
  it('points at the Test Bench flask, last in the count', async () => {
    resumeAt('play', 'simple', { onPlay: vi.fn() });
    const step = await screen.findByRole('dialog', { name: PLAY_STEP });
    expect(step).toHaveTextContent('Test Bench');
    expect(within(step).getByText(`${TOTAL} / ${TOTAL}`)).toBeInTheDocument();
    expect(document.querySelector('[data-tour-anchor="test-bench"]'))
      .toContainElement(screen.getByRole('button', { name: /^Test Bench/ }));
    expect(within(step).getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(within(step).getByRole('button', { name: 'Finish' })).toBeEnabled();
  });

  it('Finish saves, ends the tour and gives back the author’s own mode', async () => {
    resumeAt('play', 'advanced');
    const step = await screen.findByRole('dialog', { name: PLAY_STEP });
    expect(screen.getByRole('radio', { name: 'Simple' })).toHaveAttribute('data-state', 'on');
    fireEvent.click(within(step).getByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(tourBar()).not.toBeInTheDocument());
    expect(storeWorld).toHaveBeenCalledTimes(1);
    expect(readTourRecord(NEW_WORLD.id)).toBeNull();
    expect(screen.getByRole('radio', { name: 'Advanced' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByRole('radio', { name: 'Advanced' })).toBeEnabled();
    expect(readEditorMode()).toBe('advanced');
  });

  it('Play saves the world, ends the tour, then enters the world', async () => {
    const onPlay = vi.fn();
    resumeAt('play', 'simple', { onPlay });
    fireEvent.click(within(await screen.findByRole('dialog', { name: PLAY_STEP })).getByRole('button', { name: 'Play' }));

    await waitFor(() => expect(onPlay).toHaveBeenCalledWith(NEW_WORLD.id));
    expect(storeWorld).toHaveBeenCalledTimes(1);
    expect(storeWorld.mock.invocationCallOrder[0]).toBeLessThan(onPlay.mock.invocationCallOrder[0]);
    expect(readTourRecord(NEW_WORLD.id)).toBeNull();
  });

  it('does not enter the world when the save fails', async () => {
    storeWorld.mockRejectedValueOnce(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onPlay = vi.fn();
    resumeAt('play', 'simple', { onPlay });
    const play = within(await screen.findByRole('dialog', { name: PLAY_STEP })).getByRole('button', { name: 'Play' });
    fireEvent.click(play);

    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(play).toBeEnabled());
    expect(onPlay).not.toHaveBeenCalled();
    expect(readTourRecord(NEW_WORLD.id)).not.toBeNull();
  });

  it('offers Finish alone where the editor has no way to play', async () => {
    resumeAt('play');
    const step = await screen.findByRole('dialog', { name: PLAY_STEP });
    expect(within(step).queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(within(step).getByRole('button', { name: 'Finish' })).toBeEnabled();
  });
});

describe('Authoring Tour registry', () => {
  it('keeps the ending steps last', () => {
    expect(TOUR_STEPS.slice(-2).map((s) => s.id)).toEqual(['editor-mode', 'play']);
  });
});
