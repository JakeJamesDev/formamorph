import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, clickFlask, clickOpenBench, renderWorldEditorBench } from '@/test/worldEditorBench';
import { resetTutorials } from '@/lib/tutorials';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import type { World } from '@/types';

/**
 * The Authoring Tour's In Play pane, driven through the real editor: what the player sees and what each
 * prompt reads for the current step, updated as the author types, and the dock it borrows from the Bench.
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

const worldWith = (systemPrompt: string): World => benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt, use3DModel: false, tags: [],
  },
  // A New World overview, which carries no readme or openings.
} as unknown as Partial<World>);

const startTour = async (world: World) => {
  const view = renderWorldEditorBench(world, 'simple', { newWorld: true });
  const offer = await screen.findByRole('dialog', { name: 'Take the Authoring Tour?' }, { timeout: 2000 });
  fireEvent.click(within(offer).getByRole('button', { name: 'Start Tour' }));
  await screen.findByRole('dialog', { name: 'World Name' });
  return view;
};

/** From World Name to the AI-Facing Description step, the way the author gets there. Next saves, and when
 *  the one-time Save note shows, the author dismisses it to reach the step. */
const nextStep = async () => {
  fireEvent.click(within(screen.getByRole('dialog', { name: 'World Name' })).getByRole('button', { name: 'Use Example' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'World Name' })).getByRole('button', { name: 'Next' }));
  const step = () => screen.queryByRole('dialog', { name: 'AI-Facing Description' });
  const saved = () => screen.queryByRole('dialog', { name: 'Your World Is Saved' });
  await waitFor(() => expect(step() ?? saved()).not.toBeNull());
  const note = saved();
  if (note) fireEvent.click(within(note).getByRole('button', { name: 'Got It' }));
  await screen.findByRole('dialog', { name: 'AI-Facing Description' });
};

const inPlay = () => screen.queryByRole('region', { name: 'In Play' });
const playerSees = () => within(inPlay()!).getByRole('region', { name: 'Player Sees' });
const narration = () => within(inPlay()!).getByRole('region', { name: 'Narration Prompt Reads' });
const marks = (el: HTMLElement) => Array.from(el.querySelectorAll('mark')).map((m) => m.textContent);
const worldNameField = () => document.getElementById('worldName') as HTMLInputElement;
const dockedBench = () => document.querySelector('[data-panel-id="editor-bench"]');

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  reloadTourProgress();
  vi.clearAllMocks();
});

describe('In Play — World Name', () => {
  it('shows the name on the library card as the author types', async () => {
    await startTour(worldWith(''));
    expect(within(playerSees()).getByRole('heading', { name: 'New World' })).toBeInTheDocument();

    fireEvent.change(worldNameField(), { target: { value: 'Brinewell' } });
    expect(within(playerSees()).getByRole('heading', { name: 'Brinewell' })).toBeInTheDocument();
  });

  it('says the AI never reads the name', async () => {
    await startTour(worldWith(''));
    expect(within(narration()).getByText('The AI never reads the World Name')).toBeInTheDocument();
    expect(marks(narration())).toEqual([]);
  });
});

describe('In Play — AI-Facing Description', () => {
  it('shows the world block with the author text marked, and the library card with a caption', async () => {
    await startTour(worldWith(''));
    await nextStep();
    expect(within(playerSees()).getByRole('heading', { name: 'Brinewell' })).toBeInTheDocument();
    expect(within(playerSees()).getByText('Players never see the AI-Facing Description')).toBeInTheDocument();

    const note = screen.getByRole('dialog', { name: 'AI-Facing Description' });
    fireEvent.click(within(note).getByRole('button', { name: 'Use Example' }));
    await waitFor(() => expect(marks(narration())).toHaveLength(1));
    const [marked] = marks(narration());
    expect(marked).toMatch(/^Brinewell is a quiet fishing village/);
    expect(narration().textContent).toContain(marked);
  });

  it('shows text the builder transforms unmarked, rather than guessing at a match', async () => {
    await startTour(worldWith('Greet {{user}} at the gate.'));
    await nextStep();
    // The chip reads as its label in the world block, so the field's own text is nowhere in it.
    expect(narration().textContent).toContain('Greet Player Name at the gate.');
    expect(marks(narration())).toEqual([]);
  });
});

describe('In Play — Thumbnail', () => {
  it('puts the picture on the library card once Use Example loads it', async () => {
    await startTour(worldWith(''));
    await nextStep();
    const description = screen.getByRole('dialog', { name: 'AI-Facing Description' });
    fireEvent.click(within(description).getByRole('button', { name: 'Use Example' }));
    fireEvent.click(within(description).getByRole('button', { name: 'Next' }));
    const note = await screen.findByRole('dialog', { name: 'Thumbnail' });
    expect(within(note).getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(within(playerSees()).queryByRole('img')).toBeNull();

    fireEvent.click(within(note).getByRole('button', { name: 'Use Example' }));
    await waitFor(() => expect(within(note).getByRole('button', { name: 'Next' })).toBeEnabled());
    expect(within(playerSees()).getByRole('img')).toHaveAttribute('src', 'data:image/webp;base64,brinewell');
    // The world block written on the step before stays, with nothing of the picture in it.
    expect(narration().textContent).toContain('Brinewell is a quiet fishing village');
    expect(marks(narration())).toEqual([]);
    expect(within(narration()).getByText('The AI never reads the Thumbnail')).toBeInTheDocument();
  });
});

describe('In Play — the dock', () => {
  it('takes the docked Bench slot for the tour and hands it back after', async () => {
    renderWorldEditorBench(worldWith(''), 'simple', { newWorld: true });
    await clickOpenBench();
    fireEvent.click(screen.getByRole('button', { name: 'Pop Out' }));
    expect(dockedBench()).not.toBeNull();

    const offer = await screen.findByRole('dialog', { name: 'Take the Authoring Tour?' }, { timeout: 2000 });
    fireEvent.click(within(offer).getByRole('button', { name: 'Start Tour' }));
    await screen.findByRole('dialog', { name: 'World Name' });
    expect(inPlay()).not.toBeNull();
    expect(dockedBench()).toBeNull();

    // The flask still opens its popover. The full panel waits for the tour to end.
    await clickFlask();
    const popover = await screen.findByRole('dialog', { name: 'World Doctor' });
    expect(within(popover).queryByRole('button', { name: 'Open Test Bench' })).not.toBeInTheDocument();
    await clickFlask();

    fireEvent.click(screen.getByRole('button', { name: 'End Tour' }));
    expect(inPlay()).toBeNull();
    expect(dockedBench()).not.toBeNull();
  });
});
