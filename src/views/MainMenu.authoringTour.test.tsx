import { screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import WorldStorageService, { type StoredWorldRecord } from '@/services/WorldStorageService';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { readTourRecord, reloadTourProgress } from '@/lib/authoringTour/progress';
import { TOUR_STEPS } from '@/lib/authoringTour/steps';
import { resetTutorials } from '@/lib/tutorials';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));

/** A world the author already has. */
const world = (): StoredWorldRecord => ({
  id: 'kept-world', name: 'Kept World',
  data: {
    version: __APP_VERSION__,
    worldOverview: { name: 'Kept World', description: '', author: '', systemPrompt: 'Narrate the fen.', tags: [] },
    stats: [], statUpdates: [], traits: [], dictionaries: [], entities: [],
    locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }],
  },
} as unknown as StoredWorldRecord);

beforeEach(async () => {
  localStorage.clear();
  resetTutorials();
  reloadTourProgress();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
  await WorldStorageService.storeWorld(world());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Start Authoring Tour from Settings', () => {
  it('opens the editor on one new world at step 1 and leaves the stored world alone', async () => {
    const before = await WorldStorageService.getWorldData('kept-world');
    renderMainMenu();
    await screen.findByText('Kept World');

    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: /Settings/ });
    fireEvent.mouseDown(within(settings).getByRole('tab', { name: 'Data' }));
    fireEvent.click(await within(settings).findByRole('button', { name: 'Start Authoring Tour' }));

    const editor = await screen.findByRole('dialog', { name: 'World Editor' });
    await screen.findByRole('dialog', { name: TOUR_STEPS[0].title }, { timeout: 3000 });
    expect(screen.queryByRole('dialog', { name: /Settings/ })).not.toBeInTheDocument();
    const name = within(editor).getByLabelText(/World Name/) as HTMLInputElement;
    expect(name.value).toBe('New World');

    const tours = Object.keys(JSON.parse(localStorage.getItem('formamorph.authoringTour') ?? '{}'));
    expect(tours).toHaveLength(1);
    expect(tours[0]).toMatch(/^new-/);
    expect(readTourRecord(tours[0])?.step).toBe(TOUR_STEPS[0].id);
    await waitFor(async () => expect(await WorldStorageService.getWorldData('kept-world')).toEqual(before));
  });
});
