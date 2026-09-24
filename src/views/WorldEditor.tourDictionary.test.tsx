import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTHORING_TOUR_SAVE_NOTE_ID, markTutorialSeen, resetTutorials } from '@/lib/tutorials';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import WorldStorageService from '../services/WorldStorageService';
import type { World } from '@/types';

/**
 * The Authoring Tour's Dictionary steps, driven through the real editor: the entry the tour adds to the
 * Default book, and In Play's test line, which fires the entry through the Activation Tester's scan.
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

// The dev route replays every earlier step, which outlasts the default window under the whole suite's load.
vi.setConfig({ testTimeout: 15_000 });

const storeWorld = vi.mocked(WorldStorageService.storeWorld);

/** A New World: a placeholder name and the seeded Default book. */
const WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  dictionaries: [{ id: 'default-book', name: 'Default', enabled: true, entries: [] }],
} as unknown as Partial<World>);

const BELL_VALUE = 'A bronze bell that sank in the harbor long ago. Villagers say it rings beneath the water on the '
  + 'night before someone changes completely.';

const TOTAL = TOUR_STEPS.length;
const indexOf = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

const tourBar = () => screen.getByRole('region', { name: 'Authoring Tour' });
const stepNumber = () => Number(/(\d+) \//.exec(within(tourBar()).getByText(/^Authoring Tour/).textContent!)![1]);
const stepNote = () => screen.getAllByRole('dialog').find((d) => within(d).queryByText(`${stepNumber()} / ${TOTAL}`))!;
const noteButton = (name: string) => within(stepNote()).queryByRole('button', { name });

const inPlay = () => screen.getByRole('region', { name: 'In Play' });
const playerSees = () => within(inPlay()).getByRole('region', { name: 'Player Sees' });
const narration = () => within(inPlay()).getByRole('region', { name: 'Narration Prompt Reads' });
const testLine = () => within(inPlay()).getByRole<HTMLInputElement>('textbox', { name: 'Test Line' });
const typeTestLine = (text: string) => fireEvent.change(testLine(), { target: { value: text } });
const status = () => within(inPlay()).getByRole('status');
const keywordChips = () => within(within(inPlay()).getByRole('list', { name: 'Keywords' })).getAllByRole('listitem');
const lineMarks = () => Array.from(inPlay().querySelectorAll('p mark')).map((m) => m.textContent);
const marks = (el: HTMLElement) => Array.from(el.querySelectorAll('mark')).map((m) => m.textContent);

const entries = (ctx: () => { dictionaries: World['dictionaries'] }) => ctx().dictionaries!.flatMap((b) => b.entries);

/** Opens the tour at `id` through the dev route, with every earlier step's Add and Use Example taken. */
const openAt = async (id: string) => {
  window.location.hash = `#dev?tour=${id}`;
  fireEvent(window, new Event('hashchange'));
  const view = renderWorldEditorBench(WORLD, 'simple');
  await waitFor(() => expect(stepNumber()).toBe(indexOf(id) + 1));
  await screen.findByRole('dialog', { name: TOUR_STEPS[indexOf(id)].title });
  return view;
};

/** Presses Next and waits for the next step's note. */
const next = async () => {
  const at = stepNumber();
  fireEvent.click(noteButton('Next')!);
  await waitFor(() => expect(stepNumber()).toBe(at + 1));
  await screen.findByRole('dialog', { name: TOUR_STEPS[at].title });
};

const useExample = async () => {
  fireEvent.click(await waitFor(() => noteButton('Use Example')!));
  await waitFor(() => expect(noteButton('Next')).toBeEnabled());
};

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  markTutorialSeen(AUTHORING_TOUR_SAVE_NOTE_ID);
  reloadTourProgress();
  vi.clearAllMocks();
});

afterEach(() => {
  window.location.hash = '';
  fireEvent(window, new Event('hashchange'));
});

describe('Authoring Tour — Dictionary steps', () => {
  it('runs the three steps after the other tabs, in order, saving each one', async () => {
    const { ctx } = await openAt('add-dictionary-entry');
    const at = indexOf('add-dictionary-entry');
    expect(TOUR_STEPS.slice(at, at + 3).map((s) => s.id))
      .toEqual(['add-dictionary-entry', 'dictionary-name-keywords', 'dictionary-value']);
    expect(TOUR_STEPS.slice(at + 3).every((s) => s.tab === null)).toBe(true);
    expect(TOUR_STEPS.slice(0, at).some((s) => s.tab === 'dictionary')).toBe(false);
    expect(noteButton('Next')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    await waitFor(() => expect(noteButton('Next')).toBeEnabled());
    const saved = storeWorld.mock.calls.length;
    await next();

    expect(noteButton('Next')).toBeDisabled();
    await useExample();
    await next();
    await useExample();
    await next();

    expect(storeWorld.mock.calls.length - saved).toBe(3);
    expect(entries(ctx)).toEqual([expect.objectContaining({
      name: 'The Drowned Bell', key: ['bell', 'drowned bell'], value: BELL_VALUE,
    })]);
    expect(ctx().dictionaries![0].entries).toHaveLength(1);
  });

  it('needs a Name and a Trigger Keyword before Next unlocks', async () => {
    const { ctx } = await openAt('dictionary-name-keywords');
    const keyword = screen.getByPlaceholderText('e.g. dragon');
    fireEvent.change(keyword, { target: { value: 'bell' } });
    fireEvent.keyDown(keyword, { key: 'Enter' });
    await waitFor(() => expect(entries(ctx)[0].key).toEqual(['bell']));
    expect(noteButton('Next')).toBeDisabled();
    await useExample();
  });

  it('prefills the test line from the first keyword and keeps the author’s edit across steps', async () => {
    await openAt('dictionary-name-keywords');
    expect(within(playerSees()).getByText('Players never see dictionary entries')).toBeInTheDocument();
    expect(testLine()).toHaveValue('');
    expect(within(narration()).getByText('Nothing reaches the AI on this line'))
      .toBeInTheDocument();

    await useExample();
    expect(testLine()).toHaveValue('You ask Maren about the bell.');
    // A match on an entry with no Value adds nothing to the block, and the reader says so.
    expect(within(narration()).getByText('The entry fires, but adds nothing until it has a Value')).toBeInTheDocument();

    typeTestLine('Maren hums about the drowned bell.');
    await next();
    expect(testLine()).toHaveValue('Maren hums about the drowned bell.');
  });

  it('shows the entry, its Value marked, only while the test line has a keyword', async () => {
    await openAt('dictionary-value');
    expect(within(playerSees()).getByText('Players never see dictionary entries')).toBeInTheDocument();
    expect(testLine()).toHaveValue('You ask Maren about the bell.');
    await useExample();

    await waitFor(() => expect(narration()).toHaveTextContent(`The Drowned Bell: ${BELL_VALUE}`));
    expect(marks(narration())).toEqual([BELL_VALUE]);

    typeTestLine('You ask Maren about the weather.');
    await waitFor(() => expect(within(narration())
      .getByText('Nothing reaches the AI on this line')).toBeInTheDocument());
    expect(narration()).not.toHaveTextContent('The Drowned Bell');

    typeTestLine('You ask Maren about the weather and the bell.');
    await waitFor(() => expect(marks(narration())).toEqual([BELL_VALUE]));
  });

  it('says which keyword fires, lights its chip, marks it in the line, and swaps in a miss or a hit', async () => {
    await openAt('dictionary-value');
    await useExample();
    await waitFor(() => expect(status()).toHaveTextContent('Fires on “bell”'));
    expect(keywordChips().map((c) => c.textContent)).toEqual(['bell', 'drowned bell']);
    expect(keywordChips()[0].firstElementChild).toHaveClass('bg-primary');
    expect(keywordChips()[1].firstElementChild).not.toHaveClass('bg-primary');
    expect(lineMarks()).toEqual(['bell']);

    fireEvent.click(within(inPlay()).getByRole('button', { name: 'Try a Miss' }));
    expect(testLine()).toHaveValue('You ask Maren how the day went.');
    await waitFor(() => expect(status()).toHaveTextContent("Doesn't fire: the line has none of this entry's keywords"));
    expect(lineMarks()).toEqual([]);
    expect(keywordChips().every((c) => !c.firstElementChild?.classList.contains('bg-primary'))).toBe(true);

    fireEvent.click(within(inPlay()).getByRole('button', { name: 'Try a Hit' }));
    expect(testLine()).toHaveValue('You ask Maren about the bell.');
    await waitFor(() => expect(status()).toHaveTextContent('Fires on “bell”'));
  });

  it('matches with the entry’s Whole Words and Case-Sensitive settings', async () => {
    await openAt('dictionary-value');
    await useExample();

    typeTestLine('The bells ring.');
    await waitFor(() => expect(marks(narration())).toEqual([BELL_VALUE]));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Whole Words' }));
    // The Activation Tester's own sentence names the rule that stopped the entry.
    await waitFor(() => expect(status()).toHaveTextContent('whole-word matching is on'));
    expect(marks(narration())).toEqual([]);

    typeTestLine('The Bell rings.');
    await waitFor(() => expect(marks(narration())).toEqual([BELL_VALUE]));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Case-Sensitive' }));
    await waitFor(() => expect(status())
      .toHaveTextContent("Doesn't fire: “bell” appears only as “Bell”, and case-sensitive matching is on."));
    expect(marks(narration())).toEqual([]);

    typeTestLine('The Weather turns.');
    await waitFor(() => expect(within(narration())
      .getByText('Nothing reaches the AI on this line')).toBeInTheDocument());
  });
});
