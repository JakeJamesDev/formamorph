import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { ChatMessage, Daypart, GameLocation, MediaList, World } from '@/types';

/** The Weather Background in play draws through the Weather Mask of the location image on screen. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const WINDOW = 'data:image/png;base64,window';
const CELLAR = 'data:image/png;base64,cellar';
const media: MediaList = {
  'i-day': { id: 'i-day', name: 'Day', kind: 'image', data: 'data:image/png;base64,day' },
  'i-night': { id: 'i-night', name: 'Night', kind: 'image', data: 'data:image/png;base64,night' },
  'i-cellar': { id: 'i-cellar', name: 'Cellar', kind: 'image', data: 'data:image/png;base64,cellarart' },
  'k-window': { id: 'k-window', name: 'Window', kind: 'mask', data: WINDOW, type: 'image/png' },
  'k-cellar': { id: 'k-cellar', name: 'Cellar Grate', kind: 'mask', data: CELLAR, type: 'image/png' },
} as MediaList;

const during = (dayparts: Daypart[]) => [{ all: [{ kind: 'time' as const, dayparts }] }];

/** A Sheltered room whose day and night pictures share one window mask, and a cellar with its own. */
const world = (): World => {
  const base = harborWorld();
  const harbor: GameLocation = {
    id: 'harbor', name: 'Harbor', isStarting: true, sheltered: true,
    images: [
      { mediaId: 'i-day', weatherMask: 'k-window', requires: during(['dawn', 'morning', 'midday', 'afternoon', 'evening']) },
      { mediaId: 'i-night', weatherMask: 'k-window', requires: during(['night']) },
    ],
  } as GameLocation;
  const cellar = { id: 'cellar', name: 'Cellar', sheltered: true, images: [{ mediaId: 'i-cellar', weatherMask: 'k-cellar' }] } as GameLocation;
  return {
    ...base,
    worldOverview: { ...base.worldOverview, weather: { allowed: ['rain'] }, defaultTime: 'morning', mediaList: media },
    locations: [harbor, cellar],
  } as World;
};

let play: ReturnType<typeof useGameplay> | null = null;
function Probe() {
  play = useGameplay();
  return null;
}
const live = () => {
  if (!play) throw new Error('no gameplay yet');
  return play;
};
const layer = () => screen.queryByTestId('weather-background');
const backdropImage = () => screen.queryByTestId('location-backdrop-image')?.style.backgroundImage;

/** jsdom loads no images; this one reports a 16:9 picture once its source is set. */
class LoadedImage {
  onload: (() => void) | null = null;
  naturalWidth = 1600;
  naturalHeight = 900;
  set src(_value: string) { queueMicrotask(() => this.onload?.()); }
}

beforeEach(async () => {
  play = null;
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  vi.stubGlobal('Image', LoadedImage);
  const ctx = new Proxy({}, {
    get: (_t, name) => (name === 'createLinearGradient' || name === 'createRadialGradient' ? () => ({ addColorStop: () => {} }) : () => {}),
    set: () => true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  // Unmount first, so no late canvas mounts after the context stub is gone.
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Weather Mask in play', () => {
  it('shows rain in a Sheltered room through the shown image’s mask, day and night alike', async () => {
    renderGameViewer(world(), { inGameplay: <Probe /> });
    await waitFor(() => expect(layer()?.dataset.weatherMask).toBe(WINDOW));
    expect(layer()?.dataset.weatherKind).toBe('rain');
    expect(backdropImage()).toContain('base64,day');
    act(() => live().setGameTime((t) => t + 12));
    await waitFor(() => expect(backdropImage()).toContain('base64,night'));
    expect(layer()?.dataset.weatherMask).toBe(WINDOW);
  });

  it('shows a past page through its own location image’s mask', async () => {
    renderGameViewer(world(), { inGameplay: <Probe /> });
    await waitFor(() => expect(layer()?.dataset.weatherMask).toBe(WINDOW));
    const before = { ...live().saveCurrentGameState(), locationId: 'cellar' };
    act(() => {
      const g = live();
      const turn = (n: number) => [{ role: 'user', content: `go ${n}` }, { role: 'assistant', content: `went ${n}` }] as ChatMessage[];
      g.setFullMessageHistory([...turn(1), ...turn(2)]);
      g.setGameStates([before]);
      g.setUserPage(1);
    });
    await waitFor(() => expect(live().isViewingPast).toBe(true));
    await waitFor(() => expect(layer()?.dataset.weatherMask).toBe(CELLAR));
    expect(backdropImage()).toContain('base64,cellarart');
    act(() => live().setUserPage(2));
    await waitFor(() => expect(layer()?.dataset.weatherMask).toBe(WINDOW));
  });

  it('carries no mask with Location Background off, so Shelter hides the rain', async () => {
    localStorage.setItem('FORMAMORPH_locationBackground', 'false');
    renderGameViewer(world(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(live().weather).toBe('rain'));
    expect(screen.queryByTestId('location-backdrop-image')).toBeNull();
    expect(layer()).toBeNull();
  });

  it('carries no mask with Location Background off in an open location, and draws the rain in full', async () => {
    localStorage.setItem('FORMAMORPH_locationBackground', 'false');
    const open = world();
    open.locations = open.locations.map(({ sheltered: _sheltered, ...l }) => l);
    renderGameViewer(open, { inGameplay: <Probe /> });
    await waitFor(() => expect(layer()?.dataset.weatherKind).toBe('rain'));
    expect(screen.queryByTestId('location-backdrop-image')).toBeNull();
    expect(layer()?.dataset.weatherMask).toBeUndefined();
  });
});
