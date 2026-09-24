import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTHORING_TOUR_SAVE_NOTE_ID, markTutorialSeen, resetTutorials } from '@/lib/tutorials';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import { NEW_ENTITY_NAME } from '@/lib/blankWorld';
import WorldStorageService from '../services/WorldStorageService';
import type { World } from '@/types';

/**
 * The Authoring Tour's Entities steps, driven through the real editor: the add step, each field step with its
 * In Play slice, and the roster before and after the entity has a location.
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

// Each case walks about fifteen saved steps, which outlasts the default window under the whole suite's load.
vi.setConfig({ testTimeout: 20_000 });

const storeWorld = vi.mocked(WorldStorageService.storeWorld);

/** A New World overview over the harness's one location and one entity, which the tour must never adopt. */
const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  // A New World overview carries no readme or openings, which the overview type calls required.
} as unknown as Partial<World>);

const TOTAL = TOUR_STEPS.length;
const indexOf = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

const tourBar = () => screen.getByRole('region', { name: 'Authoring Tour' });
const stepNumber = () => Number(/(\d+) \//.exec(within(tourBar()).getByText(/^Authoring Tour/).textContent!)![1]);
/** The step note on screen, found by its counter. */
const stepNote = () => screen.getAllByRole('dialog').find((d) => within(d).queryByText(`${stepNumber()} / ${TOTAL}`))!;
const noteButton = (name: string) => within(stepNote()).queryByRole('button', { name });
const addButton = () => screen.getByRole('button', { name: /^Add to (Locations|Entities)$/ });

const inPlay = () => screen.getByRole('region', { name: 'In Play' });
const playerSees = () => within(inPlay()).getByRole('region', { name: 'Player Sees' });
const narration = () => within(inPlay()).getByRole('region', { name: 'Narration Prompt Reads' });
const marks = (el: HTMLElement) => Array.from(el.querySelectorAll('mark')).map((m) => m.textContent);
const NOT_IN_SCENE = 'The AI never reads an entity with no location';
const MEET_ONCE_PLACED = 'Players meet this entity once it has a location';

const row = (name: string) => screen.getAllByText(name)
  .map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]'))
  .find(Boolean)!;

const openTour = async () => {
  const view = renderWorldEditorBench(WORLD, 'simple', { newWorld: true });
  const offer = await screen.findByRole('dialog', { name: 'Take the Authoring Tour?' }, { timeout: 2000 });
  fireEvent.click(within(offer).getByRole('button', { name: 'Start Tour' }));
  await screen.findByRole('dialog', { name: TOUR_STEPS[0].title });
  return view;
};

/** Presses Next and waits for the next step's note. */
const next = async () => {
  const at = stepNumber();
  fireEvent.click(noteButton('Next')!);
  await waitFor(() => expect(stepNumber()).toBe(at + 1));
  await screen.findByRole('dialog', { name: TOUR_STEPS[at].title });
};

/** Moves to `id` the way an author in a hurry does: Add on an add step, then Use Example, then Next. */
const walkTo = async (id: string) => {
  while (TOUR_STEPS[stepNumber() - 1].id !== id) {
    if (TOUR_STEPS[stepNumber() - 1].add) fireEvent.click(addButton());
    const example = await waitFor(() => noteButton('Use Example') ?? noteButton('Next')!);
    if (example.textContent === 'Use Example') fireEvent.click(example);
    await next();
  }
};

/** Takes the current step's example. */
const useExample = () => fireEvent.click(noteButton('Use Example')!);

/** Presses Previous until the tour shows `id`. */
const backTo = async (id: string) => {
  while (TOUR_STEPS[stepNumber() - 1].id !== id) {
    const at = stepNumber();
    fireEvent.click(noteButton('Previous')!);
    await waitFor(() => expect(stepNumber()).toBe(at - 1));
  }
};

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  markTutorialSeen(AUTHORING_TOUR_SAVE_NOTE_ID);
  reloadTourProgress();
  vi.clearAllMocks();
});

describe('Authoring Tour — Entities steps', () => {
  it('runs the six steps after Locations in order, saving each one', async () => {
    const { ctx } = await openTour();
    await walkTo('add-entity');
    expect(TOUR_STEPS[indexOf('add-entity') - 1].id).toBe('location-connection');
    const saved = storeWorld.mock.calls.length;

    await walkTo(TOUR_STEPS[indexOf('entity-locations') + 1].id);
    expect(storeWorld.mock.calls.length - saved).toBe(6);
    expect(TOUR_STEPS.slice(indexOf('add-entity'), indexOf('entity-locations') + 1).map((s) => s.id)).toEqual([
      'add-entity', 'entity-name', 'entity-pronouns', 'entity-player-description', 'entity-ai-description',
      'entity-locations',
    ]);

    const tidewell = ctx().locations.find((l) => l.name === 'The Tidewell')!;
    const maren = ctx().entities.find((e) => e.id !== 'resident')!;
    expect(maren).toMatchObject({
      name: 'Maren', pronouns: 'she/her', locations: [tidewell.id],
      playerDescription: 'The keeper of the Tidewell, with a warm laugh and faint silver scales along her jaw.',
      aiDescription: expect.stringMatching(/^Maren tends the Tidewell and has bathed in it every week/),
    });
    // The last save holds the placed entity.
    expect(storeWorld.mock.calls.at(-1)![0]).toMatchObject({
      data: { entities: expect.arrayContaining([expect.objectContaining({ name: 'Maren', locations: [tidewell.id] })]) },
    });
  });

  it('waits for a new entity, then records and selects it', async () => {
    const { ctx } = await openTour();
    await walkTo('add-entity');
    // The harness world's own entity was there before the step, so it is not the tour's.
    expect(noteButton('Next')).toBeDisabled();
    expect(noteButton('Use Example')).toBeNull();

    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    const added = ctx().entities.find((e) => e.id !== 'resident')!;
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('New Entity'));

    await next();
    useExample();
    await waitFor(() => expect(ctx().entities.find((e) => e.id === added.id)?.name).toBe('Maren'));
    expect(ctx().entities.find((e) => e.id === 'resident')?.name).toBe('Odd Wick');
  });

  it('keeps Next disabled on the name Add gives until the author changes it', async () => {
    const { ctx } = await openTour();
    await walkTo('add-entity');
    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    await next();
    const added = () => ctx().entities.find((e) => e.id !== 'resident')!;
    expect(added().name).toBe(NEW_ENTITY_NAME);
    expect(noteButton('Next')).toBeDisabled();

    ctx().updateEntity({ ...added(), name: 'Old Tam' });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    ctx().updateEntity({ ...added(), name: '' });
    await waitFor(() => expect(noteButton('Next')).toBeDisabled());
    useExample();
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  });

  it('makes the add step current again when its entity is deleted', async () => {
    const { ctx } = await openTour();
    await walkTo('entity-ai-description');

    fireEvent.click(within(row('Maren')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(stepNumber()).toBe(indexOf('add-entity') + 1));
    expect(noteButton('Next')).toBeDisabled();
    expect(ctx().entities.map((e) => e.id)).toEqual(['resident']);
  });

  it('completes Locations only when the entity is in a tour location', async () => {
    const { ctx } = await openTour();
    await walkTo('entity-locations');
    expect(noteButton('Next')).toBeDisabled();

    // A location outside the tour does not count, though the AI then reads the entity there.
    const maren = ctx().entities.find((e) => e.name === 'Maren')!;
    ctx().updateEntity({ ...maren, locations: ['harbor'] });
    await waitFor(() => expect(within(playerSees()).getByText('While players are at Harbor Steps')).toBeInTheDocument());
    expect(noteButton('Next')).toBeDisabled();

    const lantern = ctx().locations.find((l) => l.name === 'The Salt Lantern')!;
    ctx().updateEntity({ ...maren, locations: ['harbor', lantern.id] });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    // The roster is the tour location's once the entity is in one.
    expect(within(playerSees()).getByText('While players are at The Salt Lantern')).toBeInTheDocument();
  });
});

describe('In Play — Entities', () => {
  it('Name: shows the list row and the card, and the AI does not read the entity yet', async () => {
    await openTour();
    await walkTo('entity-name');
    useExample();

    await waitFor(() => expect(within(playerSees()).getAllByText('Maren')).toHaveLength(2));
    expect(within(playerSees()).getByText('No description provided.')).toBeInTheDocument();
    expect(within(narration()).getByText(NOT_IN_SCENE)).toBeInTheDocument();
  });

  it('Pronouns: players never see them, and the AI does not read the entity yet', async () => {
    await openTour();
    await walkTo('entity-pronouns');
    useExample();

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Pronouns' })).toHaveValue('she/her'));
    expect(within(playerSees()).getByText('Players never see this field')).toBeInTheDocument();
    expect(within(narration()).getByText(NOT_IN_SCENE)).toBeInTheDocument();
  });

  it('Player-Facing Description: shows it on the card, and the AI never reads it', async () => {
    await openTour();
    await walkTo('entity-player-description');
    useExample();

    await waitFor(() => expect(within(playerSees())
      .getByText('The keeper of the Tidewell, with a warm laugh and faint silver scales along her jaw.'))
      .toBeInTheDocument());
    expect(within(narration()).getByText('The AI never reads this field')).toBeInTheDocument();
  });

  it('AI-Facing Description: players never see it, and the AI does not read the entity yet', async () => {
    await openTour();
    await walkTo('entity-ai-description');
    useExample();

    expect(within(playerSees()).getByText('Players never see this field')).toBeInTheDocument();
    expect(within(narration()).getByText(NOT_IN_SCENE)).toBeInTheDocument();
  });

  it('Locations: placing the entity puts it in that location’s roster', async () => {
    await openTour();
    await walkTo('entity-locations');
    expect(within(playerSees()).getByText(MEET_ONCE_PLACED)).toBeInTheDocument();
    expect(within(narration()).getByText(NOT_IN_SCENE)).toBeInTheDocument();

    useExample();
    await waitFor(() => expect(within(playerSees()).getByText('While players are at The Tidewell')).toBeInTheDocument());
    expect(within(playerSees()).queryByText(MEET_ONCE_PLACED)).toBeNull();
    expect(within(playerSees()).getByText('Maren')).toBeInTheDocument();
    expect(narration().textContent).toContain('- **Maren**');
    expect(marks(narration())).toContain('Maren');
    // Only the tour location's roster: the harness entity is elsewhere.
    expect(narration().textContent).not.toContain('Odd Wick');
  });

  it('marks each field in the roster once the entity has a location', async () => {
    await openTour();
    await walkTo('entity-locations');
    useExample();
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());

    await backTo('entity-ai-description');
    await waitFor(() => expect(marks(narration())).toHaveLength(1));
    expect(marks(narration())[0]).toMatch(/^Maren tends the Tidewell.*growing stronger\.$/);

    await backTo('entity-pronouns');
    await waitFor(() => expect(marks(narration())).toEqual(['she/her']));
    expect(narration().textContent).toContain('- **pronouns:** she/her');

    await backTo('entity-name');
    await waitFor(() => expect(marks(narration())).toContain('Maren'));
    expect(within(playerSees()).getByText('While players are at The Tidewell')).toBeInTheDocument();
  });

  it('captions the row and card until the entity has a location, on every step that shows them', async () => {
    await openTour();
    await walkTo('entity-name');
    expect(within(playerSees()).getByText(MEET_ONCE_PLACED)).toBeInTheDocument();
    await walkTo('entity-player-description');
    expect(within(playerSees()).getByText(MEET_ONCE_PLACED)).toBeInTheDocument();

    await walkTo('entity-locations');
    useExample();
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    await backTo('entity-player-description');
    await waitFor(() => expect(within(playerSees())
      .getByText('The keeper of the Tidewell, with a warm laugh and faint silver scales along her jaw.')).toBeInTheDocument());
    expect(within(playerSees()).queryByText(MEET_ONCE_PLACED)).toBeNull();
    await backTo('entity-name');
    await waitFor(() => expect(within(playerSees()).getByText('While players are at The Tidewell')).toBeInTheDocument());
    expect(within(playerSees()).queryByText(MEET_ONCE_PLACED)).toBeNull();
  });
});
