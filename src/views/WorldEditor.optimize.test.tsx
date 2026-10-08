import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import type { World } from '@/types';

/** Optimize Images rewrites the overview, the entities and the locations, and one undo takes it all back. */

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

// The author picks Optimize; the encoder's output stands in for the real WebP pass.
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const WEBP = 'data:image/webp;base64,UklGRg==';
vi.mock('@/lib/useDownscalePrompt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/useDownscalePrompt')>();
  return {
    ...actual,
    useDownscalePrompt: () => ({
      ...actual.useDownscalePrompt(),
      promptWorld: async (world: World) => ({
        ...world,
        worldOverview: { ...world.worldOverview, thumbnail: WEBP },
        entities: world.entities.map((e) => ({ ...e, images: [WEBP] })),
        locations: world.locations.map((l) => ({ ...l, backgroundImage: WEBP })),
      }),
    }),
  };
});

const WORLD = benchEditorWorld({
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: PNG, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, backgroundImage: PNG }],
  entities: [{ id: 'resident', name: 'Odd Wick', images: [PNG], locations: ['harbor'] }],
} as Partial<World>);

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
});

describe('Optimize Images', () => {
  it('undoes in one press', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    fireEvent.click(screen.getByRole('button', { name: 'More world actions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Optimize Images' }));
    await waitFor(() => expect(ctx().locations[0].backgroundImage).toBe(WEBP));
    expect(ctx().worldOverview.thumbnail).toBe(WEBP);
    expect(ctx().entities[0].images).toEqual([WEBP]);

    await act(async () => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ctx().worldOverview.thumbnail).toBe(PNG);
    expect(ctx().entities[0].images).toEqual([PNG]);
    expect(ctx().locations[0].backgroundImage).toBe(PNG);

    // Nothing earlier is left to undo.
    await act(async () => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ctx().worldOverview.thumbnail).toBe(PNG);
    await act(async () => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });
    expect(ctx().worldOverview.thumbnail).toBe(WEBP);
    expect(ctx().locations[0].backgroundImage).toBe(WEBP);
  });
});
