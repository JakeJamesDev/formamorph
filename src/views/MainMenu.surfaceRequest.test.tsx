import { screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import { createSurfaceRegistry } from '@/lib/surface/surfaceRegistry';
import WorldStorageService, { type StoredWorldRecord } from '@/services/WorldStorageService';
import AuthService from '@/services/AuthService';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';

/** A request from the help window, answered by the main menu. */

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

const world = (): StoredWorldRecord => ({
  id: 'sedge', name: 'Sedge Landing',
  data: {
    version: __APP_VERSION__,
    worldOverview: { name: 'Sedge Landing', description: '', author: '', systemPrompt: '', tags: [] },
    stats: [], statUpdates: [], traits: [], dictionaries: [], entities: [],
    locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }],
  },
} as unknown as StoredWorldRecord);

let registry: ReturnType<typeof createSurfaceRegistry>;
let requester: ReturnType<typeof createSurfaceRequester>;

/** Lets the commits after a landing run, so a tab that only flashed has moved off again. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const renderMenu = () => renderMainMenu({}, { registry, children: <requester.Requester /> });

/** Open the stored world's details from its library card, which is what the editor edits. */
const openWorld = async () => {
  fireEvent.click(await screen.findByText('Sedge Landing'));
  await screen.findByRole('button', { name: /Edit World/ });
};

beforeEach(async () => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
  await WorldStorageService.storeWorld(world());
  registry = createSurfaceRegistry();
  requester = createSurfaceRequester();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('a surface request on the main menu', () => {
  it('opens Settings on the requested tab and sub-tab', async () => {
    renderMenu();
    requester.send('settingsEndpoints.image');
    await waitFor(() => expect(registry.get()).toEqual({
      screen: 'mainMenu', dialog: 'settings', tabs: ['settings.endpoints', 'settingsEndpoints.image'],
    }));
    expect(requester.pending()).toBeNull();
  });

  it('selects a library tab', async () => {
    renderMenu();
    requester.send('mainMenu.models');
    await waitFor(() => expect(registry.get()).toEqual({ screen: 'mainMenu', dialog: null, tabs: ['mainMenu.models'] }));
  });

  it('re-selects the tab of the surface already open and leaves it open', async () => {
    renderMenu();
    requester.send('settings.output');
    await waitFor(() => expect(registry.get().tabs).toEqual(['settings.output']));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Display' }));
    await waitFor(() => expect(registry.get().tabs).toEqual(['settings.display']));

    requester.send('settings.output');
    await waitFor(() => expect(registry.get().tabs).toEqual(['settings.output']));
    expect(registry.get().dialog).toBe('settings');
  });

  it('opens Load Game for a game surface, since no game is running', async () => {
    renderMenu();
    requester.send('gameViewer.memory');
    await waitFor(() => expect(registry.get().dialog).toBe('menu'));
  });

  it('opens the World Editor on the requested tab for the open world', async () => {
    renderMenu();
    await openWorld();
    requester.send('worldEditor.stats');
    await waitFor(() => expect(registry.get().dialog).toBe('worldEditor'));
    expect(registry.get().tabs).toEqual(['worldEditor.stats']);
  });

  it('opens the Test Bench on the requested instrument', async () => {
    renderMenu();
    await openWorld();
    requester.send('worldEditorBench.triggers');
    await waitFor(() => expect(registry.get().tabs).toContain('worldEditorBench.triggers'));
    expect(registry.get().dialog).toBe('worldEditor');
  });

  it('shows the library instead of the World Editor when no world is open', async () => {
    renderMenu();
    await screen.findByText('Sedge Landing');
    requester.send('worldEditor.stats');
    await waitFor(() => expect(registry.get().tabs).toEqual(['mainMenu.worlds']));
    expect(registry.get().dialog).toBeNull();
  });

  it('runs the editor unsaved prompt before a request closes the editor with edits', async () => {
    renderMenu();
    await openWorld();
    requester.send('worldEditor.overview');
    fireEvent.change(await screen.findByDisplayValue('Sedge Landing'), { target: { value: 'Sedge Landing EDITED' } });

    requester.send('backup');
    await screen.findByText('Unsaved changes');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
    expect(registry.get().dialog).toBe('worldEditor');

    requester.send('backup');
    fireEvent.click(await screen.findByRole('button', { name: 'Exit Without Saving' }));
    await waitFor(() => expect(registry.get().dialog).toBe('backup'));
  });

  it('opens Settings over the World Editor without asking', async () => {
    renderMenu();
    await openWorld();
    requester.send('worldEditor.overview');
    fireEvent.change(await screen.findByDisplayValue('Sedge Landing'), { target: { value: 'Sedge Landing EDITED' } });

    requester.send('settings.display');
    await waitFor(() => expect(registry.get().dialog).toBe('settings'));
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });

  it('opens an Advanced-only Settings tab on Settings already open in Simple mode', async () => {
    renderMenu();
    requester.send('settings.display');
    await waitFor(() => expect(registry.get().tabs).toEqual(['settings.display']));
    requester.send('settings.prompts');
    await waitFor(() => expect(registry.get().tabs[0]).toBe('settings.prompts'));
    // Simple hides the tab's trigger, which leaves a blank panel; the player must see Prompts selected.
    await settle();
    expect(screen.getByRole('tab', { name: 'Prompts', selected: true })).toBeInTheDocument();
  });

  it('opens an Advanced-only editor tab on an editor already open in Simple mode', async () => {
    renderMenu();
    await openWorld();
    requester.send('worldEditor.overview');
    await waitFor(() => expect(registry.get().tabs).toEqual(['worldEditor.overview']));
    requester.send('worldEditor.placeholders');
    await waitFor(() => expect(registry.get().tabs).toEqual(['worldEditor.placeholders']));
    await settle();
    expect(registry.get().tabs).toEqual(['worldEditor.placeholders']);
  });

  it('opens the profile on the requested tab and keeps it there', async () => {
    const user = { id: 'me', username: 'Fen' };
    vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(user as never);
    vi.spyOn(AuthService, 'fetchUserProfile').mockResolvedValue(user as never);
    acceptAgeGate();
    renderMenu();
    await screen.findByText('Sedge Landing');
    await waitFor(() => expect(AuthService.fetchUserProfile).toHaveBeenCalled());
    requester.send('profile.settings');
    await waitFor(() => expect(registry.get()).toEqual({ screen: 'mainMenu', dialog: 'profile', tabs: ['profile.settings'] }));
    // The landing clears on the next commit; the tab must not fall back with it.
    await settle();
    expect(registry.get().tabs).toEqual(['profile.settings']);
  });

  it('re-selects a Community tab without falling back to the tab it opened on', async () => {
    acceptAgeGate();
    renderMenu();
    requester.send('community.model');
    await waitFor(() => expect(registry.get().tabs).toEqual(['community.model']));
    requester.send('community.entity');
    await waitFor(() => expect(registry.get().tabs).toEqual(['community.entity']));
    await settle();
    expect(registry.get().tabs).toEqual(['community.entity']);
  });

  it('leaves a help window surface for the help window', async () => {
    renderMenu();
    requester.send('formaquestionSettings.endpoint');
    await screen.findByText('Sedge Landing');
    expect(requester.pending()?.id).toBe('formaquestionSettings.endpoint');
    expect(registry.get().dialog).toBeNull();
  });
});
