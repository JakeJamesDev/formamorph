import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTHORING_TOUR_SAVE_NOTE_ID, markTutorialSeen, resetTutorials } from '@/lib/tutorials';
import { reloadTourProgress, writeTourRecord } from '@/lib/authoringTour/progress';
import { TOUR_STEPS, replayTourSteps } from '@/lib/authoringTour/steps';
import WorldStorageService from '../services/WorldStorageService';
import type { Stat, World } from '@/types';

/**
 * The Authoring Tour's Stats steps, driven through the real editor: the add step and its tour stat, the two
 * field steps, and In Play's two readers of one stat.
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

vi.setConfig({ testTimeout: 15_000 });

const storeWorld = vi.mocked(WorldStorageService.storeWorld);

/** A New World overview over the harness's one starting location. */
const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  // A New World overview carries no readme or openings, which the overview type calls required.
} as unknown as Partial<World>);

const SEA_CHANGE_DESCRIPTION = 'How far the Tidewell has reshaped your body. At 0 you are fully human. At 100 you '
  + 'belong to the sea. Raise it when the player bathes in the Tidewell or drinks its water.';

const TOTAL = TOUR_STEPS.length;
const indexOf = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

const tourBar = () => screen.getByRole('region', { name: 'Authoring Tour' });
const stepNumber = () => Number(/(\d+) \//.exec(within(tourBar()).getByText(/^Authoring Tour/).textContent!)![1]);
const stepNote = () => screen.getAllByRole('dialog').find((d) => within(d).queryByText(`${stepNumber()} / ${TOTAL}`))!;
const noteButton = (name: string) => within(stepNote()).queryByRole('button', { name });
const addButton = () => screen.getByRole('button', { name: 'Add to Stats' });

const inPlay = () => screen.getByRole('region', { name: 'In Play' });
const playerSees = () => within(inPlay()).queryByRole('region', { name: 'Player Sees' });
const reader = (prompt: string) => within(inPlay()).queryByRole('region', { name: `${prompt} Reads` });
const marks = (el: HTMLElement) => Array.from(el.querySelectorAll('mark')).map((m) => m.textContent);
/** The text a reader shows the prompt receiving, without its heading. */
const readText = (el: HTMLElement) => el.querySelector('pre')!.textContent;

const row = (name: string) => screen.getAllByText(name)
  .map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]'))
  .find(Boolean)!;

/** The tour stat: the one stat the tour's world holds. */
const tourStat = (ctx: () => { stats: Stat[] }) => ctx().stats[0];

/**
 * Reopens the world as an author who took every step before `stepId` left it: each earlier Add and Use
 * Example taken, and the tour record pointing at `stepId`.
 */
const resumeAt = async (stepId: string) => {
  const { world, items } = replayTourSteps(WORLD, indexOf(stepId));
  writeTourRecord(WORLD.id, { step: stepId, items });
  const view = renderWorldEditorBench({ ...WORLD, ...world }, 'simple');
  await screen.findByRole('dialog', { name: TOUR_STEPS[indexOf(stepId)].title });
  return view;
};

const next = async () => {
  const at = stepNumber();
  fireEvent.click(noteButton('Next')!);
  await waitFor(() => expect(stepNumber()).toBe(at + 1));
  await screen.findByRole('dialog', { name: TOUR_STEPS[at].title });
};

/** Adds the tour stat with the Stats tab's own Add button and moves on to the Name step. */
const addTourStat = async () => {
  fireEvent.click(addButton());
  await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  await next();
};

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  markTutorialSeen(AUTHORING_TOUR_SAVE_NOTE_ID);
  reloadTourProgress();
  vi.clearAllMocks();
});

describe('Authoring Tour — Stats steps', () => {
  it('runs the three steps right after Entities, saving each one', async () => {
    expect(TOUR_STEPS[indexOf('add-stat') - 1].tab).toBe('entities');
    expect(TOUR_STEPS.slice(indexOf('add-stat'), indexOf('add-stat') + 3).map((s) => s.id))
      .toEqual(['add-stat', 'stat-name', 'stat-description']);

    const { ctx } = await resumeAt('add-stat');
    await addTourStat();
    fireEvent.click(noteButton('Use Example')!);
    await next();
    fireEvent.click(noteButton('Use Example')!);
    await next();

    expect(storeWorld).toHaveBeenCalledTimes(3);
    expect(tourStat(ctx)).toMatchObject({
      name: 'Sea Change', min: 0, max: 100, value: 0, description: SEA_CHANGE_DESCRIPTION,
    });
    expect(storeWorld.mock.calls.at(-1)![0]).toMatchObject({
      data: { stats: [expect.objectContaining({ name: 'Sea Change', description: SEA_CHANGE_DESCRIPTION })] },
    });
  });

  it('waits for a new stat, then records and selects it', async () => {
    const { ctx } = await resumeAt('add-stat');
    expect(noteButton('Next')).toBeDisabled();
    expect(noteButton('Use Example')).toBeNull();

    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    expect(ctx().stats).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('New Stat'));
  });

  it('completes the Name step on any name, and keeps the range unless the author changes it', async () => {
    const { ctx } = await resumeAt('add-stat');
    await addTourStat();
    const added = tourStat(ctx);
    // The Add button's name already counts.
    expect(noteButton('Next')).toBeEnabled();

    ctx().updateStat({ ...added, name: '  ' });
    await waitFor(() => expect(noteButton('Next')).toBeDisabled());
    ctx().updateStat({ ...added, name: 'Grit' });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    expect(tourStat(ctx)).toMatchObject({ min: 0, max: 100, value: 0 });

    await next();
    expect(tourStat(ctx)).toMatchObject({ name: 'Grit', min: 0, max: 100, value: 0 });
  });

  it('completes the Description step on any text', async () => {
    const { ctx } = await resumeAt('add-stat');
    await addTourStat();
    await next();
    expect(noteButton('Next')).toBeDisabled();

    ctx().updateStat({ ...tourStat(ctx), description: 'Nerve.' });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  });

  it('makes the add step current again when the tour stat is deleted', async () => {
    const { ctx } = await resumeAt('add-stat');
    await addTourStat();
    fireEvent.click(noteButton('Use Example')!);
    await next();

    fireEvent.click(within(row('Sea Change')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(stepNumber()).toBe(indexOf('add-stat') + 1));
    expect(noteButton('Next')).toBeDisabled();

    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    await next();
    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(tourStat(ctx).name).toBe('Sea Change'));
  });

  it('resumes the Description step with the tour stat selected', async () => {
    await resumeAt('stat-description');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('Sea Change'));
  });

  it('replays the stat step the way the Add button makes the stat', async () => {
    const replayed = replayTourSteps(WORLD, indexOf('stat-description')).world.stats[0];
    const { ctx } = await resumeAt('add-stat');
    fireEvent.click(addButton());
    await waitFor(() => expect(ctx().stats).toHaveLength(1));
    const thresholds = (stat: Stat) => (stat.descriptors ?? []).map((d) => [d.threshold, d.description]);
    expect(thresholds(replayed)).toEqual(thresholds(tourStat(ctx)));
  });
});

describe('In Play — Stats', () => {
  it('Add: shows nothing until there is a stat', async () => {
    await resumeAt('add-stat');
    expect(playerSees()).toBeNull();
    expect(reader('Narration Prompt')).toBeNull();
    expect(reader('Stat Updates Prompt')).toBeNull();
  });

  it('Name: shows the stat row, and both prompts read the name, each in its own shape', async () => {
    await resumeAt('add-stat');
    await addTourStat();
    fireEvent.click(noteButton('Use Example')!);

    await waitFor(() => expect(within(playerSees()!).getByText('Sea Change')).toBeInTheDocument());
    expect(within(playerSees()!).getByText('0 / 100')).toBeInTheDocument();

    const narration = reader('Narration Prompt')!;
    const updates = reader('Stat Updates Prompt')!;
    expect(marks(narration)).toEqual(['Sea Change']);
    expect(marks(updates)).toEqual(['Sea Change']);
    expect(readText(updates)).toBe('- **Sea Change:** 0/100');
    // Narration reads what the stat's Add gave it, and never the number.
    expect(readText(narration)).toMatch(/^- \*\*Sea Change/);
    expect(readText(narration)).not.toContain('0/100');
  });

  it('Description: players never see it, Stat Updates marks it, and narration never reads it', async () => {
    await resumeAt('add-stat');
    await addTourStat();
    fireEvent.click(noteButton('Use Example')!);
    await next();
    expect(within(playerSees()!).getByText('Players never see this field')).toBeInTheDocument();

    fireEvent.click(noteButton('Use Example')!);
    const updates = reader('Stat Updates Prompt')!;
    await waitFor(() => expect(marks(updates)).toEqual([SEA_CHANGE_DESCRIPTION]));
    expect(readText(updates)).toBe(`- **Sea Change:** 0/100 — ${SEA_CHANGE_DESCRIPTION}`);

    const narration = reader('Narration Prompt')!;
    expect(readText(narration)).toMatch(/^- \*\*Sea Change/);
    expect(readText(narration)).not.toContain('0/100');
    expect(readText(narration)).not.toContain(SEA_CHANGE_DESCRIPTION);
    expect(marks(narration)).toEqual([]);
  });
});
