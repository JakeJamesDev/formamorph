import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTHORING_TOUR_SAVE_NOTE_ID, markTutorialSeen, resetTutorials } from '@/lib/tutorials';
import { reloadTourProgress, writeTourRecord } from '@/lib/authoringTour/progress';
import { TOUR_STEPS, replayTourSteps } from '@/lib/authoringTour/steps';
import { NEW_TRAIT_NAME } from '@/lib/blankWorld';
import WorldStorageService from '../services/WorldStorageService';
import type { Stat, Trait, World } from '@/types';

/**
 * The Authoring Tour's Traits steps, driven through the real editor: the add step and its tour trait, the
 * three field steps, and In Play's setup screen, traits block and settled stat row.
 */

vi.mock('@/lib/authoringTour/tourImages', () => ({
  loadTourImage: async (name: string) => `data:image/webp;base64,${name}`,
}));

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

/** A New World overview and trait groups over the harness's one starting location. */
const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  traitGroups: [],
  // A New World overview carries no readme or openings, which the overview type calls required.
} as unknown as Partial<World>);

const TIDE_TOUCHED_PLAYER = 'You bathed in the Tidewell once as a child, and it remembers you.';
const TIDE_TOUCHED_AI = 'The player bathed in the Tidewell as a child. Faint gill lines mark their neck, and they '
  + 'can breathe underwater for short stretches. Villagers greet them as one of their own.';

const TOTAL = TOUR_STEPS.length;
const indexOf = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

const tourBar = () => screen.getByRole('region', { name: 'Authoring Tour' });
const stepNumber = () => Number(/(\d+) \//.exec(within(tourBar()).getByText(/^Authoring Tour/).textContent!)![1]);
const stepNote = () => screen.getAllByRole('dialog').find((d) => within(d).queryByText(`${stepNumber()} / ${TOTAL}`))!;
const noteButton = (name: string) => within(stepNote()).queryByRole('button', { name });
const addButton = () => screen.getByRole('button', { name: 'Add to Traits' });

const inPlay = () => screen.getByRole('region', { name: 'In Play' });
const playerSees = () => within(inPlay()).queryByRole('region', { name: 'Player Sees' });
const reader = (prompt: string) => within(inPlay()).queryByRole('region', { name: `${prompt} Reads` });
const marks = (el: HTMLElement) => Array.from(el.querySelectorAll('mark')).map((m) => m.textContent);
/** The text a reader shows the prompt receiving, without its heading. */
const readText = (el: HTMLElement) => el.querySelector('pre')!.textContent;

type Ctx = () => { traits: Trait[]; stats: Stat[] };
/** The one trait the tour's world holds, which is the tour trait. */
const onlyTrait = (ctx: Ctx) => ctx().traits[0];

/**
 * Reopens the world as an author who took every step before `stepId` left it: each earlier Add and Use
 * Example taken, and the tour record pointing at `stepId`.
 */
const resumeAt = async (stepId: string) => {
  const { world, items } = await replayTourSteps(WORLD, indexOf(stepId));
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

/** Adds the tour trait with the Traits tab's own Add button and moves on to the Name step. */
const addTourTrait = async () => {
  fireEvent.click(addButton());
  await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  await next();
};

/** Takes the example on the current step, then moves on. */
const example = async () => {
  fireEvent.click(noteButton('Use Example')!);
  await waitFor(() => expect(noteButton('Next')).toBeEnabled());
};

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  markTutorialSeen(AUTHORING_TOUR_SAVE_NOTE_ID);
  reloadTourProgress();
  vi.clearAllMocks();
});

describe('Authoring Tour — Traits steps', () => {
  it('runs the four steps right after Stats, saving each one', async () => {
    expect(TOUR_STEPS[indexOf('add-trait') - 1].tab).toBe('stats');
    expect(TOUR_STEPS.slice(indexOf('add-trait'), indexOf('add-trait') + 4).map((s) => s.id))
      .toEqual(['add-trait', 'trait-name', 'trait-ai-description', 'trait-stat-change']);

    const { ctx } = await resumeAt('add-trait');
    await addTourTrait();
    for (let i = 0; i < 3; i++) {
      await example();
      await next();
    }

    expect(storeWorld).toHaveBeenCalledTimes(4);
    const seaChange = ctx().stats[0];
    expect(onlyTrait(ctx)).toMatchObject({
      name: 'Tide-Touched',
      playerDescription: TIDE_TOUCHED_PLAYER,
      aiDescription: TIDE_TOUCHED_AI,
      groupId: null,
      statChanges: [{ statId: seaChange.id, value: 15, type: 'starting' }],
    });
    expect(storeWorld.mock.calls.at(-1)![0]).toMatchObject({
      data: { traits: [expect.objectContaining({ name: 'Tide-Touched', aiDescription: TIDE_TOUCHED_AI })] },
    });
  });

  it('waits for a new trait, then records and selects it', async () => {
    const { ctx } = await resumeAt('add-trait');
    expect(noteButton('Next')).toBeDisabled();
    expect(noteButton('Use Example')).toBeNull();

    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    expect(ctx().traits).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('New Trait'));
  });

  it('completes the Name step once the trait has a name and a Player-Facing Description', async () => {
    const { ctx } = await resumeAt('add-trait');
    await addTourTrait();
    expect(onlyTrait(ctx).name).toBe(NEW_TRAIT_NAME);
    expect(noteButton('Next')).toBeDisabled();

    // The name Add gives never satisfies the name half, even with a description.
    ctx().updateTrait({ ...onlyTrait(ctx), playerDescription: 'Salt in the blood.' });
    await waitFor(() => expect(onlyTrait(ctx).playerDescription).toBe('Salt in the blood.'));
    expect(noteButton('Next')).toBeDisabled();

    ctx().updateTrait({ ...onlyTrait(ctx), name: 'Brine-Blooded' });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    ctx().updateTrait({ ...onlyTrait(ctx), name: '  ' });
    await waitFor(() => expect(noteButton('Next')).toBeDisabled());
    ctx().updateTrait({ ...onlyTrait(ctx), name: 'Brine-Blooded' });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    ctx().updateTrait({ ...onlyTrait(ctx), name: NEW_TRAIT_NAME });
    await waitFor(() => expect(noteButton('Next')).toBeDisabled());
    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  });

  it('completes the AI-Facing Description step on any text', async () => {
    const { ctx } = await resumeAt('trait-ai-description');
    expect(noteButton('Next')).toBeDisabled();

    ctx().updateTrait({ ...onlyTrait(ctx), aiDescription: 'Knows the tides.' });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  });

  it('completes the Stat Change step only on a change to the tour stat', async () => {
    const { ctx } = await resumeAt('trait-stat-change');
    await waitFor(() => expect(document.querySelector('[data-tour-anchor="trait-stat-changes"]')).not.toBeNull());
    expect(noteButton('Next')).toBeDisabled();

    ctx().addStat({ id: 'other', name: 'Grit', type: 'number', description: '', min: 0, max: 10, value: 0, regen: 0 });
    ctx().updateTrait({ ...onlyTrait(ctx), statChanges: [{ statId: 'other', value: 2, type: 'starting' }] });
    await waitFor(() => expect(onlyTrait(ctx).statChanges).toHaveLength(1));
    expect(noteButton('Next')).toBeDisabled();

    const tourStat = ctx().stats[0];
    ctx().updateTrait({
      ...onlyTrait(ctx), statChanges: [...onlyTrait(ctx).statChanges, { statId: tourStat.id, value: 5, type: 'min' }],
    });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  });

  it('replays the trait step the way the Add button makes the trait', async () => {
    const replayed = (await replayTourSteps(WORLD, indexOf('trait-name'))).world.traits[0];
    const { ctx } = await resumeAt('add-trait');
    fireEvent.click(addButton());
    await waitFor(() => expect(ctx().traits).toHaveLength(1));
    const { id: _replayedId, ...shape } = replayed;
    const { id: _addedId, ...added } = onlyTrait(ctx);
    expect(shape).toEqual(added);
  });
});

describe('In Play — Traits', () => {
  it('Add: shows nothing until there is a trait', async () => {
    await resumeAt('add-trait');
    expect(playerSees()).toBeNull();
    expect(reader('Narration Prompt')).toBeNull();
  });

  it('Name: shows the trait on the setup screen, picked, and the AI never reads the description', async () => {
    await resumeAt('add-trait');
    await addTourTrait();
    fireEvent.click(noteButton('Use Example')!);

    const sees = await waitFor(() => {
      const region = playerSees()!;
      expect(within(region).getByText('Tide-Touched')).toBeInTheDocument();
      return region;
    });
    // A root trait sits in the setup screen's General category.
    expect(within(sees).getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(within(sees).getByText(TIDE_TOUCHED_PLAYER)).toBeInTheDocument();
    expect(within(sees).getByRole('checkbox', { name: 'Tide-Touched' })).toBeChecked();
    expect(within(reader('Narration Prompt')!).getByText('The AI never reads this field')).toBeInTheDocument();
  });

  it('AI-Facing Description: players never see it, and the traits block holds it with the trait active', async () => {
    await resumeAt('trait-ai-description');
    expect(within(playerSees()!).getByText('Players never see this field')).toBeInTheDocument();
    // The picked trait is in the block by name before it has a description.
    expect(readText(reader('Narration Prompt')!)).toBe('## Traits\n- **Tide-Touched**');

    fireEvent.click(noteButton('Use Example')!);
    const narration = reader('Narration Prompt')!;
    await waitFor(() => expect(marks(narration)).toEqual([TIDE_TOUCHED_AI]));
    expect(readText(narration)).toBe(`## Traits\n- **Tide-Touched:** ${TIDE_TOUCHED_AI}`);
  });

  it('Stat Change: shows the change on the setup screen and the stat starting at the settled value', async () => {
    await resumeAt('trait-stat-change');
    expect(within(playerSees()!).getByText('0 / 100')).toBeInTheDocument();

    fireEvent.click(noteButton('Use Example')!);
    const sees = playerSees()!;
    await waitFor(() => expect(within(sees).getByText('15 / 100')).toBeInTheDocument());
    expect(within(sees).getByRole('listitem')).toHaveTextContent('Sea Change: +15');
    // The traits block never lists stat changes, so nothing in it is marked.
    const narration = reader('Narration Prompt')!;
    expect(readText(narration)).toBe(`## Traits\n- **Tide-Touched:** ${TIDE_TOUCHED_AI}`);
    expect(marks(narration)).toEqual([]);
  });

  it('Stat Change: the stat row clamps the start to the stat\'s Max', async () => {
    const { ctx } = await resumeAt('trait-stat-change');
    ctx().updateStat({ ...ctx().stats[0], value: 95 });
    await waitFor(() => expect(within(playerSees()!).getByText('95 / 100')).toBeInTheDocument());

    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(within(playerSees()!).getByText('100 / 100')).toBeInTheDocument());
    expect(within(playerSees()!).queryByText('110 / 100')).toBeNull();
  });
});
