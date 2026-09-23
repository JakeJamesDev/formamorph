import { screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import WorldStorageService from '@/services/WorldStorageService';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { AUTHORING_TOUR_OFFER_ID, markTutorialSeen, resetTutorials } from '@/lib/tutorials';
import { readTourRecord, reloadTourProgress, writeTourRecord } from '@/lib/authoringTour/progress';
import type { StoredWorldRecord } from '@/services/WorldStorageService';

/** The Authoring Tour's Play, from the World Editor back through the main menu's own Enter World flow. */

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

/** A world with an Introduction and choices to make, so entry shows both the readme and the setup screen. */
const TOUR_WORLD: StoredWorldRecord = {
  id: 'tour-world', name: 'Brinewell',
  data: {
    version: __APP_VERSION__,
    worldOverview: {
      name: 'Brinewell', description: '', author: '', systemPrompt: 'A cold coast.', use3DModel: false, tags: [],
      introReadme: '# Welcome to Brinewell\nThe tide is coming in.',
    },
    stats: [], entities: [], statUpdates: [], dictionaries: [],
    traits: [
      { id: 'touched', name: 'Tide-Touched', isDefault: true, statChanges: [] },
      { id: 'dry', name: 'Landlubber', statChanges: [] },
    ],
    locations: [
      { id: 'tidewell', name: 'The Tidewell', isStarting: true },
      { id: 'lantern', name: 'The Salt Lantern', isStarting: true },
    ],
  },
};

beforeEach(async () => {
  localStorage.clear();
  resetTutorials();
  reloadTourProgress();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
  await WorldStorageService.storeWorld(TOUR_WORLD);
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Authoring Tour Play', () => {
  it('saves the world and enters it through the Introduction and the setup screen', async () => {
    // An author who took the tour and left it on its last step.
    markTutorialSeen(AUTHORING_TOUR_OFFER_ID);
    writeTourRecord(TOUR_WORLD.id, { step: 'play', items: {} });
    const storeWorld = vi.spyOn(WorldStorageService, 'storeWorld');
    const onStartGame = vi.fn();
    renderMainMenu({ onStartGame });
    fireEvent.click(await screen.findByText('Brinewell'));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit World' }));

    const step = await screen.findByRole('dialog', { name: 'Play Your World' }, { timeout: 3000 });
    fireEvent.click(within(step).getByRole('button', { name: 'Play' }));

    const intro = await screen.findByRole('dialog', { name: 'Introduction' });
    expect(within(intro).getByRole('heading', { name: 'Welcome to Brinewell' })).toBeInTheDocument();
    expect(storeWorld).toHaveBeenCalledWith(expect.objectContaining({ id: TOUR_WORLD.id }));
    expect(readTourRecord(TOUR_WORLD.id)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'World Editor' })).not.toBeInTheDocument();

    fireEvent.click(within(intro).getByRole('button', { name: 'Close' }));
    const setup = await screen.findByRole('dialog', { name: 'Enter Brinewell' });
    expect(within(setup).getByRole('checkbox', { name: 'Tide-Touched' })).toBeChecked();
    fireEvent.click(within(setup).getByRole('button', { name: 'Start game' }));
    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce());
    expect(onStartGame.mock.calls[0][0]).toEqual(['touched']);
  });
});
