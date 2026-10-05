import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import { createSurfaceRegistry } from '@/lib/surface/surfaceRegistry';
import type { World } from '@/types';

/** A request from the help window, answered by a running game. */

// The hosted build: the Default preset is the Demo AI, so entering a game raises the gate the tests dismiss.
// Pinned here so a developer's `.env.local` endpoint cannot hide the gate.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('kokoro-js', () => ({ KokoroTTS: { from_pretrained: vi.fn() } }));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const WORLD = {
  id: 'w1',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: false, tags: [],
  },
  stats: [], locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }], entities: [], traits: [], statUpdates: [],
} as unknown as World;

let registry: ReturnType<typeof createSurfaceRegistry>;
let requester: ReturnType<typeof createSurfaceRequester>;
let onExitToMenu: ReturnType<typeof vi.fn>;

/** Enter the game and dismiss the AI setup gate the default endpoint raises, as a player does. */
async function enterGame() {
  renderGameViewer(WORLD, { onExitToMenu, registry, children: <requester.Requester /> });
  fireEvent.click(await screen.findByRole('button', { name: 'Keep Playing' }));
  await waitFor(() => expect(registry.get().dialog).toBeNull());
}

beforeEach(() => {
  localStorage.clear();
  registry = createSurfaceRegistry();
  requester = createSurfaceRequester();
  onExitToMenu = vi.fn();
});

describe('a surface request in a running game', () => {
  it('opens Settings on the requested tab', async () => {
    await enterGame();
    requester.send('settings.output');
    await waitFor(() => expect(registry.get()).toEqual({ screen: 'gameViewer', dialog: 'settings', tabs: ['settings.output'] }));
    expect(requester.pending()).toBeNull();
  });

  it('selects a side panel tab on the game screen', async () => {
    await enterGame();
    requester.send('gameViewer.memory');
    await waitFor(() => expect(registry.get().tabs).toEqual(['gameViewer.memory']));
  });

  it('re-selects the tab of the surface already open and leaves it open', async () => {
    await enterGame();
    requester.send('settings.output');
    await waitFor(() => expect(registry.get().tabs).toEqual(['settings.output']));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Display' }));
    await waitFor(() => expect(registry.get().tabs).toEqual(['settings.display']));

    requester.send('settings.output');
    await waitFor(() => expect(registry.get().tabs).toEqual(['settings.output']));
    expect(registry.get().dialog).toBe('settings');
  });

  it('opens an editor surface in the in-game editor without asking to leave', async () => {
    await enterGame();
    requester.send('worldEditor.stats');
    await waitFor(() => expect(registry.get()).toEqual({ screen: 'gameViewer', dialog: 'worldEditor', tabs: ['worldEditor.stats'] }));
    expect(screen.queryByText('Exit to Main Menu')).toBeNull();
  });

  it('asks before leaving for a main menu surface, and a refusal changes nothing', async () => {
    await enterGame();
    requester.send('backup');
    await screen.findByText('Exit to Main Menu');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Exit to Main Menu')).toBeNull());
    expect(onExitToMenu).not.toHaveBeenCalled();
    expect(requester.pending()).toBeNull();
    expect(registry.get()).toEqual({ screen: 'gameViewer', dialog: null, tabs: expect.any(Array) });
  });

  it('leaves the game on a confirm and keeps the request for the main menu', async () => {
    await enterGame();
    requester.send('backup');
    await screen.findByText('Exit to Main Menu');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onExitToMenu).toHaveBeenCalledTimes(1);
    expect(requester.pending()?.id).toBe('backup');
  });

  it('asks to leave before the editor prompt, so a refusal keeps the editor and its edits', async () => {
    await enterGame();
    requester.send('worldEditor.overview');
    fireEvent.change(await screen.findByDisplayValue('Sedge Landing'), { target: { value: 'Sedge Landing EDITED' } });

    requester.send('backup');
    await screen.findByText('Exit to Main Menu');
    expect(screen.queryByText('Unsaved changes')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Exit to Main Menu')).toBeNull());
    expect(registry.get().dialog).toBe('worldEditor');
    expect(screen.getByDisplayValue('Sedge Landing EDITED')).toBeInTheDocument();
    expect(requester.pending()).toBeNull();

    requester.send('backup');
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Exit Without Saving' }));
    expect(onExitToMenu).toHaveBeenCalledTimes(1);
    expect(requester.pending()?.id).toBe('backup');
  });

  it('runs the editor unsaved prompt before a request closes the editor with edits', async () => {
    await enterGame();
    requester.send('worldEditor.overview');
    fireEvent.change(await screen.findByDisplayValue('Sedge Landing'), { target: { value: 'Sedge Landing EDITED' } });

    requester.send('export');
    await screen.findByText('Unsaved changes');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
    expect(registry.get().dialog).toBe('worldEditor');

    requester.send('export');
    fireEvent.click(await screen.findByRole('button', { name: 'Exit Without Saving' }));
    await waitFor(() => expect(registry.get().dialog).toBe('export'));
  });
});
