import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTHORING_TOUR_OFFER_ID, resetTutorials, seenTutorials } from '@/lib/tutorials';
import { readTourRecord, reloadTourProgress } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import WorldStorageService from '../services/WorldStorageService';
import type { World } from '@/types';

/**
 * The ways into the Authoring Tour besides the new-world offer: the offer on the first editor visit to any
 * other world, and a start the host asks for (the Settings row). Both build a new world for the tour.
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

/** A world the author already has. Its own id, so a tour on the new world is not a tour on it. */
const LIBRARY_WORLD: World = benchEditorWorld({ id: 'sedge' });

const NEW_WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
} as unknown as Partial<World>);

const OFFER = 'Take the Authoring Tour?';
const MODE_NOTE = 'Simple vs. Advanced';
/** Tutorial notes wait out the appear delay; the full suite runs these files in parallel, so allow for load. */
const findNote = (name: string) => screen.findByRole('dialog', { name }, { timeout: 4000 });
const findStepNote = () => findNote(TOUR_STEPS[0].title);
const queryNote = (name: string) => screen.queryByRole('dialog', { name });
const worldNameField = () => document.getElementById('worldName') as HTMLInputElement;
const storedIds = () => storeWorld.mock.calls.map(([record]) => record.id);

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  reloadTourProgress();
  vi.clearAllMocks();
  getWorldMetadata.mockResolvedValue([]);
});

describe('first-visit offer', () => {
  it('offers the tour on a world that is not new, before the mode note', async () => {
    renderWorldEditorBench(LIBRARY_WORLD, 'simple');
    const offer = await findNote(OFFER);
    expect(offer).toHaveTextContent('Build a new world one field at a time');
    expect(queryNote(MODE_NOTE)).not.toBeInTheDocument();

    fireEvent.click(within(offer).getByRole('button', { name: 'No Thanks' }));
    await findNote(MODE_NOTE);
    expect(queryNote(OFFER)).not.toBeInTheDocument();
  });

  it('keeps the new-world wording on a new world', async () => {
    renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    expect(await findNote(OFFER)).toHaveTextContent('Build this world one field at a time');
  });

  it('holds the offer in the in-game editor without spending it', async () => {
    renderWorldEditorBench(LIBRARY_WORLD, 'simple', { inGame: true });
    // The mode note is next in line, so its arrival shows the offer had its chance and stayed away.
    await findNote(MODE_NOTE);
    expect(queryNote(OFFER)).not.toBeInTheDocument();
    expect(seenTutorials()).not.toContain(AUTHORING_TOUR_OFFER_ID);
  });

  it('Start Tour builds a new world and leaves the open one unchanged', async () => {
    const { ctx } = renderWorldEditorBench(LIBRARY_WORLD, 'simple');
    fireEvent.click(within(await findNote(OFFER)).getByRole('button', { name: 'Start Tour' }));

    await findStepNote();
    const tourWorldId = ctx().worldId!;
    expect(tourWorldId).toMatch(/^new-/);
    expect(readTourRecord(tourWorldId)?.step).toBe(TOUR_STEPS[0].id);
    expect(readTourRecord('sedge')).toBeNull();
    expect(worldNameField().value).toBe('New World');
    expect(storedIds()).not.toContain('sedge');
    expect(seenTutorials()).toContain(AUTHORING_TOUR_OFFER_ID);
    // The tour locks the switch the mode note explains, so the note waits.
    expect(queryNote(MODE_NOTE)).not.toBeInTheDocument();
  });
});

describe('first-visit offer over unsaved edits', () => {
  const editThenStart = async () => {
    const view = renderWorldEditorBench(LIBRARY_WORLD, 'simple');
    const offer = await findNote(OFFER);
    fireEvent.change(worldNameField(), { target: { value: 'Sedge Landing, Revised' } });
    fireEvent.click(within(offer).getByRole('button', { name: 'Start Tour' }));
    return { ...view, prompt: await screen.findByRole('alertdialog', { name: 'Unsaved changes' }, { timeout: 4000 }) };
  };

  it('Cancel keeps the world and leaves the offer on screen, unspent', async () => {
    const { ctx, prompt } = await editThenStart();
    fireEvent.click(within(prompt).getByRole('button', { name: 'Cancel' }));

    await findNote(OFFER);
    expect(ctx().worldId).toBe('sedge');
    expect(worldNameField().value).toBe('Sedge Landing, Revised');
    expect(seenTutorials()).not.toContain(AUTHORING_TOUR_OFFER_ID);
  });

  it('Exit Without Saving drops the edits and starts the tour on a new world', async () => {
    const { ctx, prompt } = await editThenStart();
    fireEvent.click(within(prompt).getByRole('button', { name: 'Exit Without Saving' }));

    await findStepNote();
    expect(ctx().worldId).toMatch(/^new-/);
    expect(storedIds()).not.toContain('sedge');
    expect(queryNote(OFFER)).not.toBeInTheDocument();
    expect(queryNote(MODE_NOTE)).not.toBeInTheDocument();
    expect(seenTutorials()).toContain(AUTHORING_TOUR_OFFER_ID);
  });

  it('Save & Exit stores the edits, then starts the tour on a new world', async () => {
    const { ctx, prompt } = await editThenStart();
    fireEvent.click(within(prompt).getByRole('button', { name: 'Save & Exit' }));

    await findStepNote();
    expect(ctx().worldId).toMatch(/^new-/);
    const saved = storeWorld.mock.calls.find(([record]) => record.id === 'sedge');
    expect((saved?.[0].data as World).worldOverview.name).toBe('Sedge Landing, Revised');
  });
});

describe('shared offer seen-state', () => {
  it('declining the first-visit offer retires the new-world offer', async () => {
    const first = renderWorldEditorBench(LIBRARY_WORLD, 'simple');
    fireEvent.click(within(await findNote(OFFER)).getByRole('button', { name: 'No Thanks' }));
    first.unmount();

    renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    await findNote(MODE_NOTE);
    expect(queryNote(OFFER)).not.toBeInTheDocument();
  });

  it('declining the new-world offer retires the first-visit offer', async () => {
    const first = renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    fireEvent.click(within(await findNote(OFFER)).getByRole('button', { name: 'No Thanks' }));
    first.unmount();

    renderWorldEditorBench(LIBRARY_WORLD, 'simple');
    await findNote(MODE_NOTE);
    expect(queryNote(OFFER)).not.toBeInTheDocument();
  });

  it('taking the new-world offer retires the first-visit offer', async () => {
    const first = renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    fireEvent.click(within(await findNote(OFFER)).getByRole('button', { name: 'Start Tour' }));
    await findStepNote();
    first.unmount();

    renderWorldEditorBench(LIBRARY_WORLD, 'simple');
    await findNote(MODE_NOTE);
    expect(queryNote(OFFER)).not.toBeInTheDocument();
  });

  it('taking the first-visit offer retires the new-world offer', async () => {
    const first = renderWorldEditorBench(LIBRARY_WORLD, 'simple');
    fireEvent.click(within(await findNote(OFFER)).getByRole('button', { name: 'Start Tour' }));
    await findStepNote();
    first.unmount();

    renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    await findNote(MODE_NOTE);
    expect(queryNote(OFFER)).not.toBeInTheDocument();
  });
});

describe('a start the host asks for', () => {
  it('starts the tour at step 1 on the new world, with no offer, and retires the offer', async () => {
    const { ctx } = renderWorldEditorBench(NEW_WORLD, 'advanced', { newWorld: true, startTour: true });
    await findStepNote();
    expect(queryNote(OFFER)).not.toBeInTheDocument();
    await waitFor(() => expect(readTourRecord(ctx().worldId)?.step).toBe(TOUR_STEPS[0].id));
    expect(seenTutorials()).toContain(AUTHORING_TOUR_OFFER_ID);
  });
});
