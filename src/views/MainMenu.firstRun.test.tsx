import { act, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { serverEvent } from '@/test/serverEvents';
import AuthService from '@/services/AuthService';
import WorldStorageService from '@/services/WorldStorageService';
import { tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { isFirstRunStepSeen, markFirstRunStepSeen } from '@/lib/firstTimeFlowStore';
import { resetTutorials, TUTORIAL_APPEAR_DELAY_MS } from '@/lib/tutorials';
import { useGameData } from '@/contexts/GameDataContext';
import { toast } from 'react-toastify';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

/** The events the stubbed server reports as running. */
let running: unknown[] = [];

const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetTutorials();
  running = [];
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith(`${AuthService.API_URL}/events/active`)) return answer({ data: running });
    return answer({ data: [] });
  }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const step = () => screen.queryByRole('dialog', { name: 'Welcome to Formamorph' });
const poster = () => screen.queryByRole('dialog', { name: /Winter World-Building Contest/ });

/** Reads the world id the game data holds, the id a save of the game would carry. */
const LoadedWorld = () => <span data-testid="loaded-world">{useGameData().worldId ?? 'none'}</span>;

describe('the first-run step', () => {
  it('offers Browse Worlds on the left and Play Emberwatch on the right, in that DOM order', async () => {
    renderMainMenu({ introSeenAtLaunch: false });

    const dialog = await screen.findByRole('dialog', { name: 'Welcome to Formamorph' });
    const labels = within(dialog).getAllByRole('button').map((button) => button.textContent);

    expect(labels).toEqual(['Browse Worlds', 'Play Emberwatch']);
  });

  it('never opens for a device that had the intro-seen record at launch', async () => {
    renderMainMenu({ introSeenAtLaunch: true });
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

    expect(step()).not.toBeInTheDocument();
  });

  it('stays closed while the intro plays', async () => {
    renderMainMenu({ introSeenAtLaunch: false, introActive: true });
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

    expect(step()).not.toBeInTheDocument();
  });

  it('does not open again once it has been seen', async () => {
    markFirstRunStepSeen();
    renderMainMenu({ introSeenAtLaunch: false });
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

    expect(step()).not.toBeInTheDocument();
  });

  it.each([
    ['Browse Worlds', () => fireEvent.click(screen.getByRole('button', { name: 'Browse Worlds' }))],
    ['Escape', () => fireEvent.keyDown(screen.getByRole('dialog', { name: 'Welcome to Formamorph' }), { key: 'Escape' })],
  ])('closes on %s, stays on the main menu and records the step as seen', async (_name, close) => {
    const onStartGame = vi.fn();
    renderMainMenu({ introSeenAtLaunch: false, onStartGame });
    await screen.findByRole('dialog', { name: 'Welcome to Formamorph' });

    close();

    await waitFor(() => expect(step()).not.toBeInTheDocument());
    expect(isFirstRunStepSeen()).toBe(true);
    expect(onStartGame).not.toHaveBeenCalled();
  });

  it('starts Emberwatch past the Enter World steps when the player picks Play Emberwatch', async () => {
    const onStartGame = vi.fn();
    renderMainMenu({ introSeenAtLaunch: false, onStartGame }, { children: <LoadedWorld /> });

    fireEvent.click(await screen.findByRole('button', { name: 'Play Emberwatch' }));

    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce(), { timeout: 15000 });
    expect(screen.getByTestId('loaded-world')).toHaveTextContent('emberwatch');
    expect(screen.queryByRole('dialog', { name: 'Enter World' })).not.toBeInTheDocument();
    expect(isFirstRunStepSeen()).toBe(true);
  }, 20000);

  it('starts from the bundled copy under the stored id when the seeder has not stored the world yet', async () => {
    const stored = vi.spyOn(WorldStorageService, 'getWorldData').mockRejectedValue('World not found');
    const onStartGame = vi.fn();
    renderMainMenu({ introSeenAtLaunch: false, onStartGame }, { children: <LoadedWorld /> });

    fireEvent.click(await screen.findByRole('button', { name: 'Play Emberwatch' }));

    await waitFor(() => expect(onStartGame).toHaveBeenCalledOnce(), { timeout: 15000 });
    expect(stored).toHaveBeenCalledWith('emberwatch');
    // The id a save carries is the id the seeder stores the same world under.
    expect(screen.getByTestId('loaded-world')).toHaveTextContent('emberwatch');
    await waitFor(async () => expect(await WorldStorageService.getWorldIds()).toContain('emberwatch'));
  }, 20000);

  it('does not start a pristine copy when the stored world fails to read', async () => {
    vi.spyOn(WorldStorageService, 'getWorldData').mockRejectedValue('Invalid world data format');
    const onStartGame = vi.fn();
    renderMainMenu({ introSeenAtLaunch: false, onStartGame });

    fireEvent.click(await screen.findByRole('button', { name: 'Play Emberwatch' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    expect(onStartGame).not.toHaveBeenCalled();
  });

  it('offers Browse Worlds alone when the player deleted Emberwatch', async () => {
    tombstoneDefaultWorld('emberwatch');
    renderMainMenu({ introSeenAtLaunch: false });

    const dialog = await screen.findByRole('dialog', { name: 'Welcome to Formamorph' });

    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Browse Worlds']);
  });

  it('holds an event dialog until the step closes', async () => {
    running = [serverEvent()];
    renderMainMenu({ introSeenAtLaunch: false });
    await screen.findByRole('dialog', { name: 'Welcome to Formamorph' });
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(poster()).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Browse Worlds' }));

    expect(await screen.findByRole('dialog', { name: /Winter World-Building Contest/ })).toBeInTheDocument();
  });

  it('starts the main menu tutorial only after the step closes, with its own appear delay', async () => {
    renderMainMenu({ introSeenAtLaunch: false });
    await screen.findByRole('dialog', { name: 'Welcome to Formamorph' });
    // Longer than the appear delay: a tutorial that kept running behind the step would be ready by now.
    await act(() => new Promise((resolve) => setTimeout(resolve, TUTORIAL_APPEAR_DELAY_MS + 400)));
    const tutorialShown = () => /Create a free account to like and comment/.test(document.body.textContent ?? '');
    expect(tutorialShown()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Browse Worlds' }));
    await waitFor(() => expect(step()).not.toBeInTheDocument());
    await act(() => new Promise((resolve) => setTimeout(resolve, 150)));

    expect(tutorialShown()).toBe(false);
    await waitFor(() => expect(tutorialShown()).toBe(true), { timeout: 3000 });
  });
});
