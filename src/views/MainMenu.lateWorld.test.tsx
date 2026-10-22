import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import WorldStorageService from '@/services/WorldStorageService';
import { endWorldOptimize, reportWorldOptimize } from '@/lib/worldOptimizeProgress';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), warning: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

const world = (name: string) => ({
  worldOverview: { name, description: '', author: '', systemPrompt: '', tags: [] },
  stats: [], statUpdates: [], traits: [], dictionaries: [], locations: [], entities: [],
});

beforeEach(() => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('a world stored behind the Main Menu', () => {
  it('joins the library without a reopen, as a download that lands after Community Creations closes', async () => {
    await WorldStorageService.storeWorld({ id: 'held', name: 'Saltmarsh', data: world('Saltmarsh') as never });
    renderMainMenu();
    // The menu's own load has landed, so only something listening can bring in a later world.
    await screen.findByText('Saltmarsh');
    expect(screen.queryByText('Harrow Fen')).toBeNull();

    // What the download coordinator writes once its fetch finishes, with nothing telling the menu.
    await WorldStorageService.storeWorld({ id: 'downloaded-late', name: 'Harrow Fen', data: world('Harrow Fen') as never });

    expect(await screen.findByText('Harrow Fen')).toBeInTheDocument();
  });
});

describe('a world whose images are optimizing', () => {
  const deleteItem = async () => {
    fireEvent.contextMenu(screen.getByText('Saltmarsh'));
    return screen.findByRole('menuitem', { name: 'Delete' });
  };

  it('offers Delete again as soon as the run ends, with nothing else happening', async () => {
    await WorldStorageService.storeWorld({ id: 'held', name: 'Saltmarsh', data: world('Saltmarsh') as never });
    renderMainMenu();
    await screen.findByText('Saltmarsh');

    act(() => reportWorldOptimize('held', 0.5));
    expect(await deleteItem()).toHaveAttribute('data-disabled');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull());

    act(() => endWorldOptimize('held'));
    expect(await deleteItem()).not.toHaveAttribute('data-disabled');
  });
});
