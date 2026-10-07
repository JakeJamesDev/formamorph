import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { AUTHORING_TOUR_OFFER_ID, markTutorialSeen, resetTutorials } from '@/lib/tutorials';
import { reloadTourProgress, writeTourRecord } from '@/lib/authoringTour/progress';
import { NEW_WORLD_NAME } from '@/lib/blankWorld';
import type { World } from '@/types';

/** The World Editor's mobile footer and pushed detail: one footer row, Export World once, and a detail with the full height. */

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

const WORLD = benchEditorWorld({});

const button = (name: string | RegExp) => screen.getByRole('button', { name });
/** True when each element comes after the one before it in the document. */
const inOrder = (elements: HTMLElement[]) => elements.every((el, i) => i === 0
  || (elements[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
const filterBox = () => screen.queryByPlaceholderText('Filter Entities');
const addMenu = () => screen.queryByRole('button', { name: 'Add to Entities' });

let undoMobile: (() => void) | null = null;
beforeEach(() => {
  localStorage.clear();
  resetTutorials();
  reloadTourProgress();
  undoMobile = asMobile();
});
afterEach(() => { undoMobile?.(); undoMobile = null; });

describe('World Editor footer (mobile)', () => {
  it('shows Export World once on Overview in Simple, then an icon-only Save', () => {
    renderWorldEditorBench(WORLD, 'simple', { initialTab: 'overview' });
    const exports = screen.getAllByRole('button', { name: 'Export World' });
    expect(exports).toHaveLength(1);
    expect(inOrder([exports[0], button('Save')])).toBe(true);
    expect(button('Save')).toHaveTextContent(/^$/);
  });

  it('holds the More world actions menu on Overview in Advanced, with no Export World of its own', () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'overview' });
    expect(screen.queryByRole('button', { name: 'Export World' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Optimize Images' })).toBeNull();
    expect(inOrder([button('More world actions'), button('Save')])).toBe(true);
  });

  it.each(['entities', 'dictionary'] as const)('leads with Save to Library on %s, then the world actions and Save', (tab) => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: tab });
    expect(inOrder([button('Save to Library'), button('More world actions'), button('Save')])).toBe(true);
  });

  it('leaves Save to Library off a tab with no selected content', () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'locations' });
    expect(screen.queryByRole('button', { name: 'Save to Library' })).toBeNull();
    expect(inOrder([button('More world actions'), button('Save')])).toBe(true);
  });

  it('enables Save once the world has a change', () => {
    renderWorldEditorBench(WORLD, 'simple', { initialTab: 'entities' });
    expect(button('Save')).toBeDisabled();
    fireEvent.click(button('Add to Entities'));
    fireEvent.click(button('Add Entity'));
    expect(button('Save')).toBeEnabled();
  });
});

describe('World Editor detail (mobile)', () => {
  it('covers the + and filter row while an item is open, and Back brings the row back', () => {
    renderWorldEditorBench(WORLD, 'advanced', { initialTab: 'entities' });
    expect(filterBox()).not.toBeNull();
    expect(addMenu()).not.toBeNull();

    fireEvent.click(screen.getByText('Odd Wick'));
    expect(filterBox()).toBeNull();
    expect(addMenu()).toBeNull();

    fireEvent.click(button('Back to Entities'));
    expect(filterBox()).not.toBeNull();
    expect(addMenu()).not.toBeNull();
  });
});

// Cast: the overview type requires fields that a New World overview does not have.
const NEW_WORLD = benchEditorWorld({
  worldOverview: {
    name: NEW_WORLD_NAME, description: 'A blank world ready for editing', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
} as unknown as Partial<World>);

describe('Authoring Tour anchors (mobile)', () => {
  it('points the Save note at the footer Save icon', async () => {
    renderWorldEditorBench(NEW_WORLD, 'simple', { newWorld: true });
    const offer = await screen.findByRole('dialog', { name: 'Take the Authoring Tour?' }, { timeout: 2000 });
    fireEvent.click(within(offer).getByRole('button', { name: 'Start Tour' }));
    const first = await screen.findByRole('dialog', { name: 'World Name' });
    fireEvent.click(within(first).getByRole('button', { name: 'Use Example' }));
    await act(async () => { fireEvent.click(within(first).getByRole('button', { name: 'Next' })); });

    expect(await screen.findByRole('dialog', { name: 'Your World Is Saved' })).toBeInTheDocument();
    const anchors = document.querySelectorAll('[data-tour-anchor="save"]');
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toBe(button('Save'));
  });

  it('closes the open detail on an add step, so the step reaches the +', async () => {
    markTutorialSeen(AUTHORING_TOUR_OFFER_ID);
    writeTourRecord(WORLD.id, { step: 'location-starting', items: { location: 'harbor' } });
    renderWorldEditorBench(WORLD, 'simple');
    const starting = await screen.findByRole('dialog', { name: 'Starting Location' });
    expect(screen.queryByRole('button', { name: 'Add to Locations' })).toBeNull();

    await act(async () => { fireEvent.click(within(starting).getByRole('button', { name: 'Next' })); });
    // The tour's first save shows its one-time note before the step.
    const saved = await screen.findByRole('dialog', { name: 'Your World Is Saved' });
    fireEvent.click(within(saved).getByRole('button', { name: 'Got It' }));
    expect(await screen.findByRole('dialog', { name: 'Add a Second Location' })).toBeInTheDocument();
    expect(document.querySelector('[data-tour-anchor="list-add"]'))
      .toContainElement(button('Add to Locations'));
  });

  it('points the last step at the header Test Bench', async () => {
    markTutorialSeen(AUTHORING_TOUR_OFFER_ID);
    writeTourRecord(NEW_WORLD.id, { step: 'play', items: {} });
    renderWorldEditorBench(NEW_WORLD, 'simple', { onPlay: vi.fn() });
    expect(await screen.findByRole('dialog', { name: 'Play Your World' })).toBeInTheDocument();
    await waitFor(() => expect(document.querySelectorAll('[data-tour-anchor="test-bench"]')).toHaveLength(1));
    expect(document.querySelector('[data-tour-anchor="test-bench"]'))
      .toContainElement(button(/^Test Bench/));
  });
});
