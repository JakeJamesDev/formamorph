import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTHORING_TOUR_SAVE_NOTE_ID, markTutorialSeen, resetTutorials } from '@/lib/tutorials';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import { NEW_LOCATION_NAME } from '@/lib/blankWorld';
import WorldStorageService from '../services/WorldStorageService';
import type { World } from '@/types';

/**
 * The Authoring Tour's Locations steps, driven through the real editor: the add steps and the tour items
 * they record, each field step with its In Play slice, and the recovery after a tour location is deleted.
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

// Each case walks up to ten saved steps, which outlasts the default window under the whole suite's load.
vi.setConfig({ testTimeout: 15_000 });

const storeWorld = vi.mocked(WorldStorageService.storeWorld);

/** A New World overview over the harness's one starting location, which the tour must never adopt. */
const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  // A New World overview carries no readme or openings, which the overview type calls required.
} as unknown as Partial<World>);

/** The world as the last save stored it, the way the editor opens it again. */
const lastSaved = (): World => ({
  ...WORLD,
  // The stored record types its payload's slices as `unknown`; the editor wrote them as a World.
  ...(storeWorld.mock.calls.at(-1)![0].data as unknown as Partial<World>),
});

const TOTAL = TOUR_STEPS.length;
const indexOf = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

const tourBar = () => screen.getByRole('region', { name: 'Authoring Tour' });
const stepNumber = () => Number(/(\d+) \//.exec(within(tourBar()).getByText(/^Authoring Tour/).textContent!)![1]);
/** The step note on screen, found by its counter. */
const stepNote = () => screen.getAllByRole('dialog').find((d) => within(d).queryByText(`${stepNumber()} / ${TOTAL}`))!;
const noteButton = (name: string) => within(stepNote()).queryByRole('button', { name });
const addButton = () => screen.getByRole('button', { name: 'Add to Locations' });

const inPlay = () => screen.getByRole('region', { name: 'In Play' });
const playerSees = () => within(inPlay()).getByRole('region', { name: 'Player Sees' });
const reader = (prompt: string) => within(inPlay()).queryByRole('region', { name: `${prompt} Reads` });
const marks = (el: HTMLElement) => Array.from(el.querySelectorAll('mark')).map((m) => m.textContent);

const row = (name: string) => screen.getAllByText(name)
  .map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]'))
  .find(Boolean)!;

const openTour = async (world: World = WORLD) => {
  const view = renderWorldEditorBench(world, 'simple', { newWorld: true });
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

/** Walks the tour to `id` the way an author in a hurry does: Add on an add step, then Use Example, then Next. */
const walkTo = async (id: string) => {
  while (TOUR_STEPS[stepNumber() - 1].id !== id) {
    if (TOUR_STEPS[stepNumber() - 1].add) fireEvent.click(addButton());
    // The one step with no example asks for the author's own click.
    if (TOUR_STEPS[stepNumber() - 1].id === 'location-starting') {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Starting Location' }));
    }
    const example = await waitFor(() => noteButton('Use Example') ?? noteButton('Next')!);
    if (example.textContent === 'Use Example') {
      fireEvent.click(example);
      // A picture example loads its file first.
      await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    }
    await next();
  }
};

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  markTutorialSeen(AUTHORING_TOUR_SAVE_NOTE_ID);
  reloadTourProgress();
  vi.clearAllMocks();
});

describe('Authoring Tour — Locations steps', () => {
  it('runs the seven steps after Overview in order, saving each one', async () => {
    const { ctx } = await openTour();
    await walkTo('add-location');
    expect(stepNote()).toHaveAccessibleName('Add a Location');
    const saved = storeWorld.mock.calls.length;

    await walkTo(TOUR_STEPS[indexOf('location-connection') + 1].id);
    expect(storeWorld.mock.calls.length - saved).toBe(9);
    expect(TOUR_STEPS.slice(indexOf('add-location'), indexOf('location-connection') + 1).map((s) => s.id)).toEqual([
      'add-location', 'location-name', 'location-player-description', 'location-ai-description', 'location-image',
      'location-starting', 'add-second-location', 'second-location-name', 'location-connection',
    ]);

    const [tidewell, lantern] = ctx().locations.filter((l) => l.id !== 'harbor');
    expect(tidewell).toMatchObject({
      name: 'The Tidewell', isStarting: true,
      playerDescription: 'A ring of worn stone around a pool that rises and falls with the sea.',
      aiDescription: expect.stringMatching(/^A round stone basin in the village square\./),
    });
    expect(lantern).toMatchObject({
      name: 'The Salt Lantern',
      playerDescription: 'The village inn, warm and smelling of peat smoke and fried fish.',
      aiDescription: expect.stringMatching(/^A two-story inn on the harbor\./),
    });
    expect(ctx().connections).toEqual([expect.objectContaining({ aiHint: 'down the lane past the net sheds' })]);
    const [link] = ctx().connections;
    expect([link.from, link.to].sort()).toEqual([tidewell.id, lantern.id].sort());
    // The last save holds the whole Locations slice.
    expect(storeWorld.mock.calls.at(-1)![0]).toMatchObject({
      data: { connections: [expect.objectContaining({ aiHint: 'down the lane past the net sheds' })] },
    });
  });
});

describe('Authoring Tour — add steps', () => {
  it('waits for a new location, then records and selects it', async () => {
    const { ctx } = await openTour();
    await walkTo('add-location');
    // The harness world's own location was there before the step, so it is not the tour's.
    expect(noteButton('Next')).toBeDisabled();
    expect(noteButton('Use Example')).toBeNull();

    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    const added = ctx().locations.find((l) => l.id !== 'harbor')!;
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('New Location'));

    await next();
    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(ctx().locations.find((l) => l.id === added.id)?.name).toBe('The Tidewell'));
    expect(ctx().locations.find((l) => l.id === 'harbor')?.name).toBe('Harbor Steps');
  });

  it('keeps Next disabled on the name Add gives until the author changes it', async () => {
    const { ctx } = await openTour();
    await walkTo('add-location');
    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    await next();
    const added = () => ctx().locations.find((l) => l.id !== 'harbor')!;
    expect(added().name).toBe(NEW_LOCATION_NAME);
    expect(noteButton('Next')).toBeDisabled();

    ctx().updateLocation({ ...added(), name: 'Kelp Yard' });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    ctx().updateLocation({ ...added(), name: '' });
    await waitFor(() => expect(noteButton('Next')).toBeDisabled());
    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  });

  it('asks only for the + press on the second add step, before and after the press', async () => {
    const { ctx } = await openTour();
    await walkTo('add-second-location');
    expect(noteButton('Next')).toBeDisabled();
    expect(noteButton('Use Example')).toBeNull();

    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    expect(noteButton('Use Example')).toBeNull();
    expect(ctx().locations.at(-1)).toMatchObject({ name: 'New Location', playerDescription: '', aiDescription: '' });
  });

  it('Second Location Name waits for a chosen name, and its example fills the whole place', async () => {
    const { ctx } = await openTour();
    await walkTo('second-location-name');
    expect(noteButton('Next')).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('New Location');

    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    expect(ctx().locations.at(-1)).toMatchObject({
      name: 'The Salt Lantern',
      playerDescription: 'The village inn, warm and smelling of peat smoke and fried fish.',
      aiDescription: expect.stringMatching(/^A two-story inn on the harbor\./),
      backgroundImage: 'data:image/webp;base64,saltLantern',
    });
    // The first tour location keeps its own text.
    expect(ctx().locations.filter((l) => l.name === 'The Tidewell')).toHaveLength(1);
    // In Play stands at the new place.
    expect(within(playerSees()).getByRole('button', { name: 'Current Location: The Salt Lantern' })).toBeInTheDocument();
    expect(marks(reader('Narration Prompt')!)).toEqual(['The Salt Lantern']);
  });

  it('Back to Tour selects the step’s location again', async () => {
    await openTour();
    await walkTo('location-name');
    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('The Tidewell'));

    fireEvent.click(row('Harbor Steps'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('Harbor Steps'));
    fireEvent.click(within(tourBar()).getByRole('button', { name: 'Back to Tour' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('The Tidewell'));
  });

  it('makes the add step current again when its location is deleted', async () => {
    const { ctx } = await openTour();
    await walkTo('location-connection');

    fireEvent.click(within(row('The Tidewell')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(stepNumber()).toBe(indexOf('add-location') + 1));
    expect(stepNote()).toHaveAccessibleName('Add a Location');
    expect(noteButton('Next')).toBeDisabled();

    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    const replacement = ctx().locations.find((l) => l.id !== 'harbor' && l.name === 'New Location')!;
    await next();
    // The steps after it read the new location.
    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(ctx().locations.find((l) => l.id === replacement.id)?.name).toBe('The Tidewell'));
  });

  it('makes the second add step current when the second location is deleted, and keeps the first', async () => {
    const { ctx } = await openTour();
    await walkTo('location-connection');
    const first = ctx().locations.find((l) => l.name === 'The Tidewell')!;

    fireEvent.click(within(row('The Salt Lantern')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(stepNumber()).toBe(indexOf('add-second-location') + 1));
    fireEvent.click(addButton());
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    await next();
    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    await next();
    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(ctx().connections).toHaveLength(1));
    expect([ctx().connections[0].from, ctx().connections[0].to]).toContain(first.id);
  });

  it('resumes a Locations step with its location selected', async () => {
    const first = await openTour();
    await walkTo('location-ai-description');
    first.unmount();

    renderWorldEditorBench(lastSaved(), 'simple');
    await screen.findByRole('dialog', { name: 'AI-Facing Description' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveTextContent('The Tidewell'));
  });

  it('reopens at the add step when the saved world no longer holds the tour location', async () => {
    const first = await openTour();
    await walkTo('location-ai-description');
    first.unmount();

    const saved = lastSaved();
    renderWorldEditorBench({ ...saved, locations: saved.locations.filter((l) => l.name !== 'The Tidewell') }, 'simple');
    await screen.findByRole('dialog', { name: 'Add a Location' });
    expect(stepNumber()).toBe(indexOf('add-location') + 1);
    expect(noteButton('Next')).toBeDisabled();
  });
});

describe('Authoring Tour — completion', () => {
  it('completes Starting Location only when the tour’s own location starts a game', async () => {
    await openTour();
    await walkTo('location-starting');
    // The harness world's location already starts a game. The tour's own location does not yet.
    expect(noteButton('Next')).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Starting Location' }));
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  });

  it('completes the Connection step on a Connection between the tour locations, hint or not', async () => {
    const { ctx } = await openTour();
    await walkTo('location-connection');
    expect(noteButton('Next')).toBeDisabled();
    const [tidewell] = ctx().locations.filter((l) => l.name === 'The Tidewell');
    const lantern = ctx().locations.find((l) => l.name === 'The Salt Lantern')!;

    // A Connection to a location outside the tour does not count.
    ctx().addConnection({ id: 'other', from: lantern.id, to: 'harbor', twoWay: true });
    await waitFor(() => expect(ctx().connections).toHaveLength(1));
    expect(noteButton('Next')).toBeDisabled();

    ctx().addConnection({ id: 'tour', from: tidewell.id, to: lantern.id, twoWay: false });
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
  });
});

describe('In Play — Locations', () => {
  it('Background Image: opens the Media tab, and the picture sits behind the Location tab', async () => {
    const { ctx } = await openTour();
    await walkTo('location-image');
    expect(screen.getByRole('tab', { name: 'Media' })).toHaveAttribute('aria-selected', 'true');
    expect(noteButton('Next')).toBeDisabled();
    expect(within(playerSees()).queryByTestId('location-backdrop-image')).toBeNull();

    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    expect(ctx().locations.at(-1)?.backgroundImage).toBe('data:image/webp;base64,tidewell');
    expect(within(playerSees()).getByTestId('location-backdrop-image'))
      .toHaveStyle({ backgroundImage: 'url(data:image/webp;base64,tidewell)' });
    // The location block stays, with nothing of the picture in it.
    expect(reader('Narration Prompt')!.textContent).toContain('- **name:** The Tidewell');
    expect(marks(reader('Narration Prompt')!)).toEqual([]);
    expect(within(reader('Narration Prompt')!).getByText('The AI never reads the Background Image')).toBeInTheDocument();
  });

  it('Name: shows the Location tab and the location block with the name marked', async () => {
    await openTour();
    await walkTo('location-name');
    fireEvent.click(noteButton('Use Example')!);

    await waitFor(() => expect(within(playerSees()).getByRole('button', { name: 'Current Location: The Tidewell' }))
      .toBeInTheDocument());
    expect(marks(reader('Narration Prompt')!)).toEqual(['The Tidewell']);
    expect(reader('Narration Prompt')!.textContent).toContain('- **name:** The Tidewell');
  });

  it('Player-Facing Description: shows it in the Location tab, and the AI never reads it', async () => {
    await openTour();
    await walkTo('location-player-description');
    fireEvent.click(noteButton('Use Example')!);

    await waitFor(() => expect(within(playerSees())
      .getByText('A ring of worn stone around a pool that rises and falls with the sea.')).toBeInTheDocument());
    // The location block stays, without the description.
    const narration = reader('Narration Prompt')!;
    expect(narration.textContent).toContain('- **name:** The Tidewell');
    expect(narration.textContent).not.toContain('A ring of worn stone');
    expect(marks(narration)).toEqual([]);
    expect(within(narration).getByText('The AI never reads the Player-Facing Description')).toBeInTheDocument();
  });

  it('AI-Facing Description: the Location tab stays with a caption, and the location block marks it', async () => {
    await openTour();
    await walkTo('location-ai-description');
    expect(within(playerSees()).getByRole('button', { name: 'Current Location: The Tidewell' })).toBeInTheDocument();
    expect(within(playerSees()).getByText('Players never see the AI-Facing Description')).toBeInTheDocument();

    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(marks(reader('Narration Prompt')!)).toHaveLength(1));
    expect(marks(reader('Narration Prompt')!)[0]).toMatch(/^A round stone basin in the village square\./);
    expect(within(playerSees()).queryByText('A round stone basin', { exact: false })).toBeNull();
  });

  it('Starting Location: offers no example, and says where a new game starts under the Location tab', async () => {
    const { ctx } = await openTour();
    await walkTo('location-starting');
    expect(noteButton('Use Example')).toBeNull();
    expect(noteButton('Next')).toBeDisabled();
    expect(within(playerSees()).getByRole('button', { name: 'Current Location: The Tidewell' })).toBeInTheDocument();
    expect(within(playerSees()).getByText('A new game starts at another location')).toBeInTheDocument();
    expect(reader('Narration Prompt')!.textContent).toContain('- **name:** The Tidewell');
    expect(within(reader('Narration Prompt')!).getByText('The AI never reads the Starting Location')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Starting Location' }));
    await waitFor(() => expect(within(playerSees()).getByText('A new game starts here')).toBeInTheDocument());
    expect(noteButton('Next')).toBeEnabled();
    expect(ctx().locations.find((l) => l.name === 'The Tidewell')?.isStarting).toBe(true);
  });

  it('Connection: shows Connected Locations and the destinations list with the hint marked', async () => {
    await openTour();
    await walkTo('location-connection');
    fireEvent.click(noteButton('Use Example')!);

    await waitFor(() => expect(within(playerSees()).getByText('Connected Locations:')).toBeInTheDocument());
    expect(within(playerSees()).getByRole('listitem')).toHaveTextContent('The Salt Lantern');
    const change = reader('Location Change Prompt')!;
    expect(change.textContent).toContain('- **The Salt Lantern:** A two-story inn on the harbor.');
    expect(change.textContent).toContain('— via down the lane past the net sheds');
    expect(marks(change)).toEqual(['down the lane past the net sheds']);
    // Narration never reads the destinations list.
    expect(reader('Narration Prompt')).toBeNull();
  });

  it('Connection: stands where the Connection leaves from, and follows a change of direction', async () => {
    const { ctx } = await openTour();
    await walkTo('location-connection');
    fireEvent.click(noteButton('Use Example')!);
    await waitFor(() => expect(ctx().connections).toHaveLength(1));
    const [tidewell, lantern] = ['The Tidewell', 'The Salt Lantern'].map((n) => ctx().locations.find((l) => l.name === n)!.id);
    // The step selects the second location, so the only direction control on screen runs from there.
    const setDirection = async (name: 'Outgoing' | 'Incoming', from: string, to: string) => {
      fireEvent.click(screen.getByRole('radio', { name }));
      await waitFor(() => expect(ctx().connections[0]).toMatchObject({ from, to, twoWay: false }));
    };

    /** Player Sees and the Location Change reader both stand at `here` and list `there`, hint marked. */
    const expectStandsAt = async (here: string, there: string) => {
      await waitFor(() => expect(within(playerSees()).getByRole('button', { name: `Current Location: ${here}` }))
        .toBeInTheDocument());
      expect(within(playerSees()).getByRole('listitem')).toHaveTextContent(there);
      const change = reader('Location Change Prompt')!;
      expect(change.textContent).toContain(`- **${there}:**`);
      expect(change.textContent).not.toContain(`- **${here}:**`);
      expect(marks(change)).toEqual(['down the lane past the net sheds']);
    };

    // Two-Way: the first tour location.
    await expectStandsAt('The Tidewell', 'The Salt Lantern');
    // One-way, second → first: the second tour location, the only end with somewhere to go.
    await setDirection('Outgoing', lantern, tidewell);
    await expectStandsAt('The Salt Lantern', 'The Tidewell');
    // One-way, first → second: the first tour location again.
    await setDirection('Incoming', tidewell, lantern);
    await expectStandsAt('The Tidewell', 'The Salt Lantern');
  });
});
