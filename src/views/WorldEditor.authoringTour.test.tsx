import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTHORING_TOUR_SAVE_NOTE_ID, markTutorialSeen, resetTutorials } from '@/lib/tutorials';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import { readEditorMode } from '@/lib/editorMode';
import { WORLD_EDITOR_TABS } from './worldEditorTabs';
import WorldStorageService from '../services/WorldStorageService';
import type { World } from '@/types';

/**
 * The Authoring Tour, driven through the real editor the way an author takes it: the offer on a new world,
 * then the step note, the tour bar and the editor around them.
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

/** A world as New World makes it: a placeholder name and nothing for the AI. */
const NEW_WORLD: World = benchEditorWorld({
  worldOverview: {
    name: 'New World', description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
} as unknown as Partial<World>);

const UNNAMED_WORLD: World = benchEditorWorld({
  worldOverview: {
    name: '', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', use3DModel: false, tags: [],
  },
} as unknown as Partial<World>);

/** The offer waits out the tutorial layer's appear delay. */
const findOffer = () => screen.findByRole('dialog', { name: 'Take the Authoring Tour?' }, { timeout: 2000 });

const openTourOn = async (world: World, mode: 'simple' | 'advanced' = 'simple') => {
  const view = renderWorldEditorBench(world, mode, { newWorld: true });
  fireEvent.click(within(await findOffer()).getByRole('button', { name: 'Start Tour' }));
  await screen.findByRole('dialog', { name: TOUR_STEPS[0].title });
  return view;
};

const TOTAL = TOUR_STEPS.length;

const note = (title: string) => screen.getByRole('dialog', { name: title });
const tourBar = () => screen.queryByRole('region', { name: 'Authoring Tour' });
// By id: the step note carries the field's name too, so a label lookup finds both.
const worldNameField = () => document.getElementById('worldName') as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  // The Save note has its own suite. These start from an author who has read it.
  markTutorialSeen(AUTHORING_TOUR_SAVE_NOTE_ID);
  reloadTourProgress();
  vi.clearAllMocks();
  getWorldMetadata.mockResolvedValue([]);
});

describe('Authoring Tour offer', () => {
  it('offers the tour on a new world with Start Tour and No Thanks', async () => {
    renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    const offer = await findOffer();
    expect(within(offer).getByRole('button', { name: 'Start Tour' })).toBeInTheDocument();
    expect(within(offer).getByRole('button', { name: 'No Thanks' })).toBeInTheDocument();
    // The mode note waits behind the offer rather than sharing the screen with it.
    expect(screen.queryByRole('dialog', { name: 'Simple vs. Advanced' })).not.toBeInTheDocument();
  });

  // The first-visit offer, which builds a new world rather than touring this one (WorldEditor.tourStart.test).
  it('offers a world from the library a tour on a new world', async () => {
    renderWorldEditorBench(benchEditorWorld({}), 'simple');
    expect(await findOffer()).toHaveTextContent('Build a new world one field at a time');
  });

  it('does not offer the tour on a world loaded over the new one', async () => {
    const { ctx } = renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    await waitFor(() => expect(ctx().worldId).toBe('w1'));
    act(() => { ctx().loadWorldData({ ...NEW_WORLD, id: 'imported' }); });
    await screen.findByRole('dialog', { name: 'Simple vs. Advanced' }, { timeout: 2000 });
    expect(screen.queryByRole('dialog', { name: 'Take the Authoring Tour?' })).not.toBeInTheDocument();
  });

  it('never comes back after No Thanks', async () => {
    const first = renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    fireEvent.click(within(await findOffer()).getByRole('button', { name: 'No Thanks' }));
    expect(screen.queryByRole('dialog', { name: 'Take the Authoring Tour?' })).not.toBeInTheDocument();
    expect(tourBar()).not.toBeInTheDocument();
    first.unmount();

    renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    // The mode note is next in line, so its arrival shows the offer had its chance and stayed away.
    await screen.findByRole('dialog', { name: 'Simple vs. Advanced' }, { timeout: 2000 });
    expect(screen.queryByRole('dialog', { name: 'Take the Authoring Tour?' })).not.toBeInTheDocument();
  });

  it('Start Tour runs the tour from the World Name step', async () => {
    await openTourOn(NEW_WORLD);
    expect(screen.queryByRole('dialog', { name: 'Take the Authoring Tour?' })).not.toBeInTheDocument();
    expect(within(note('World Name')).getByText(`1 / ${TOTAL}`)).toBeInTheDocument();
    expect(within(tourBar()!).getByText(`Authoring Tour · 1 / ${TOTAL}`)).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(worldNameField()));
  });
});

describe('Authoring Tour steps', () => {
  it('shows Next enabled on a step whose field already has a value', async () => {
    await openTourOn(NEW_WORLD);
    expect(within(note('World Name')).getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('keeps Next disabled until the field has a value', async () => {
    await openTourOn(UNNAMED_WORLD);
    const next = within(note('World Name')).getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    fireEvent.change(worldNameField(), { target: { value: '   ' } });
    expect(next).toBeDisabled();
    fireEvent.change(worldNameField(), { target: { value: 'Fenmoor' } });
    expect(next).toBeEnabled();
  });

  it('Use Example fills the field and enables Next', async () => {
    await openTourOn(UNNAMED_WORLD);
    fireEvent.click(within(note('World Name')).getByRole('button', { name: 'Use Example' }));
    expect(worldNameField().value).toBe('Brinewell');
    expect(within(note('World Name')).getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('Next saves the world, then moves on; Previous goes back', async () => {
    await openTourOn(NEW_WORLD);
    fireEvent.click(within(note('World Name')).getByRole('button', { name: 'Use Example' }));
    fireEvent.click(within(note('World Name')).getByRole('button', { name: 'Next' }));

    const second = await screen.findByRole('dialog', { name: 'AI-Facing Description' });
    expect(storeWorld).toHaveBeenCalledTimes(1);
    expect(storeWorld.mock.calls[0][0]).toMatchObject({ id: 'w1', name: 'Brinewell' });
    expect(within(second).getByText(`2 / ${TOTAL}`)).toBeInTheDocument();
    expect(within(tourBar()!).getByText(`Authoring Tour · 2 / ${TOTAL}`)).toBeInTheDocument();
    expect(within(second).getByRole('button', { name: 'Next' })).toBeDisabled();

    fireEvent.click(within(second).getByRole('button', { name: 'Use Example' }));
    await waitFor(() => expect(document.querySelector('[data-tour-anchor="world-ai-description"]')?.textContent)
      .toContain('Brinewell is a quiet fishing village'));
    expect(within(second).getByRole('button', { name: 'Next' })).toBeEnabled();

    fireEvent.click(within(second).getByRole('button', { name: 'Previous' }));
    expect(await screen.findByRole('dialog', { name: 'World Name' })).toBeInTheDocument();
    // Going back is not a completed step, so nothing more is saved.
    expect(storeWorld).toHaveBeenCalledTimes(1);
  });

  it('Next saves the AI-Facing Description and moves on', async () => {
    await openTourOn(NEW_WORLD);
    fireEvent.click(within(note('World Name')).getByRole('button', { name: 'Next' }));
    const second = await screen.findByRole('dialog', { name: 'AI-Facing Description' });
    fireEvent.click(within(second).getByRole('button', { name: 'Use Example' }));
    fireEvent.click(within(second).getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('dialog', { name: TOUR_STEPS[2].title })).toBeInTheDocument();
    expect(within(tourBar()!).getByText(`Authoring Tour · 3 / ${TOTAL}`)).toBeInTheDocument();
    expect(storeWorld).toHaveBeenCalledTimes(2);
    expect(storeWorld.mock.calls[1][0]).toMatchObject({
      data: { worldOverview: { systemPrompt: expect.stringContaining('Brinewell is a quiet fishing village') } },
    });
  });

  it('keeps the step when the save fails', async () => {
    storeWorld.mockRejectedValueOnce(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await openTourOn(NEW_WORLD);
    const next = within(note('World Name')).getByRole('button', { name: 'Next' });
    fireEvent.click(next);
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(next).toBeEnabled());
    expect(note('World Name')).toBeInTheDocument();
    expect(within(tourBar()!).getByText(`Authoring Tour · 1 / ${TOTAL}`)).toBeInTheDocument();
  });

  it('Back to Tour returns to the step tab and focuses its field', async () => {
    await openTourOn(NEW_WORLD);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Stats' }));
    await waitFor(() => expect(document.getElementById('worldName')).toBeNull());
    // The note has nothing to point at on another tab, so it waits rather than floating over nothing.
    expect(screen.queryByRole('dialog', { name: 'World Name' })).not.toBeInTheDocument();

    fireEvent.click(within(tourBar()!).getByRole('button', { name: 'Back to Tour' }));
    expect(await screen.findByRole('dialog', { name: 'World Name' })).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(worldNameField()));
  });

  it('stands down while a dialog covers its field, and returns when it closes', async () => {
    await openTourOn(NEW_WORLD);
    fireEvent.click(within(note('World Name')).getByRole('button', { name: 'Use Example' }));
    // A dirty world makes the back arrow ask first, which is the dialog that covers the editor.
    const back = document.querySelector('svg.lucide-arrow-left')?.closest('button');
    fireEvent.click(back!);
    await screen.findByRole('alertdialog');
    // Wait for the note to leave before Escape: a note still on top would take the key itself.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'World Name' })).not.toBeInTheDocument());

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('dialog', { name: 'World Name' })).toBeInTheDocument();
  });

  it('renders every step anchor on its tab', async () => {
    renderWorldEditorBench(NEW_WORLD, 'simple');
    for (const step of TOUR_STEPS) {
      // A step with no tab points at the header, so it is checked from a tab of no step's own.
      const label = step.tab ? WORLD_EDITOR_TABS.find((t) => t.value === step.tab)!.label : 'Stats';
      // Leave the tab first, so each step's anchor is found on a fresh render of its own tab.
      fireEvent.mouseDown(screen.getByRole('tab', { name: step.tab ? 'Stats' : 'Overview' }));
      fireEvent.mouseDown(screen.getByRole('tab', { name: label }));
      await waitFor(() => expect(
        document.querySelectorAll(`[data-tour-anchor="${step.anchor}"]`),
        `step ${step.id}`,
      ).toHaveLength(1));
    }
  });
});

describe('Authoring Tour mode, End Tour and resume', () => {
  it('shows Simple while it runs and gives back the author’s own mode after', async () => {
    await openTourOn(NEW_WORLD, 'advanced');
    expect(screen.queryByRole('tab', { name: 'Placeholders' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Simple' })).toHaveAttribute('data-state', 'on');
    expect(screen.getByRole('radio', { name: 'Simple' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Advanced' })).toBeDisabled();
    expect(readEditorMode()).toBe('advanced');
    // The locked switch takes no pointer events, so the tip sits on the box around it.
    await userEvent.hover(document.querySelector('[aria-label="Editor mode"]')!.parentElement!);
    expect(await screen.findByText('End the Authoring Tour to switch modes', { selector: 'div' })).toBeVisible();

    fireEvent.click(within(tourBar()!).getByRole('button', { name: 'End Tour' }));
    expect(await screen.findByRole('tab', { name: 'Placeholders' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Advanced' })).toBeEnabled();
    expect(readEditorMode()).toBe('advanced');
  });

  it('End Tour removes the tour from this world for good', async () => {
    const first = await openTourOn(NEW_WORLD);
    fireEvent.click(within(tourBar()!).getByRole('button', { name: 'End Tour' }));
    expect(tourBar()).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'World Name' })).not.toBeInTheDocument();
    first.unmount();

    renderWorldEditorBench(NEW_WORLD, 'simple');
    await screen.findByRole('dialog', { name: 'Simple vs. Advanced' }, { timeout: 2000 });
    expect(tourBar()).not.toBeInTheDocument();
  });

  it('resumes at the stored step when the world opens again', async () => {
    const first = await openTourOn(NEW_WORLD);
    fireEvent.click(within(note('World Name')).getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: 'AI-Facing Description' });
    first.unmount();

    renderWorldEditorBench(NEW_WORLD, 'simple');
    const resumed = await screen.findByRole('dialog', { name: 'AI-Facing Description' });
    expect(within(resumed).getByText(`2 / ${TOTAL}`)).toBeInTheDocument();
    expect(within(tourBar()!).getByText(`Authoring Tour · 2 / ${TOTAL}`)).toBeInTheDocument();
  });

  it('drops the progress of a world that no longer exists', async () => {
    const first = await openTourOn(NEW_WORLD);
    first.unmount();
    // The world was never saved, and nothing is stored under its id when another world opens.
    getWorldMetadata.mockClear();
    const other = renderWorldEditorBench({ ...NEW_WORLD, id: 'w2' }, 'simple');
    await waitFor(() => expect(getWorldMetadata).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    other.unmount();

    renderWorldEditorBench(NEW_WORLD, 'simple');
    await screen.findByRole('dialog', { name: 'Simple vs. Advanced' }, { timeout: 2000 });
    expect(tourBar()).not.toBeInTheDocument();
  });
});
