import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
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
// A test that sets `hold` keeps the run open at 2 of 5 images until `hold` settles.
const run = vi.hoisted(() => ({ starts: 0, hold: null as Promise<void> | null }));
vi.mock('@/lib/useDownscalePrompt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/useDownscalePrompt')>();
  return {
    ...actual,
    useDownscalePrompt: () => ({
      ...actual.useDownscalePrompt(),
      promptWorld: async (world: World, onProgress?: (done: number, total: number) => void) => {
        run.starts += 1;
        if (run.hold) { onProgress?.(2, 5); await run.hold; }
        return {
          ...world,
          worldOverview: { ...world.worldOverview, thumbnail: WEBP },
          entities: world.entities.map((e) => ({ ...e, images: [WEBP] })),
          locations: world.locations.map((l) => ({ ...l, backgroundImage: WEBP })),
        };
      },
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
  run.starts = 0;
  run.hold = null;
});

describe('Optimize Images', () => {
  it('spins and reports progress in its tooltip while it runs, and ignores a second click', async () => {
    let finish!: () => void;
    run.hold = new Promise<void>((resolve) => { finish = resolve; });
    renderWorldEditorBench(WORLD, 'advanced');
    const optimize = screen.getByRole('button', { name: 'Optimize Images' });
    expect(optimize.querySelector('.animate-spin')).toBeNull();

    fireEvent.click(optimize);
    await waitFor(() => expect(optimize).toHaveAttribute('aria-disabled', 'true'));
    expect(optimize.querySelector('.animate-spin')).not.toBeNull();
    // The name stays put while the tooltip carries the count.
    expect(screen.getByRole('button', { name: 'Optimize Images' })).toBe(optimize);
    await userEvent.hover(optimize);
    expect(await screen.findByText('Optimizing 2/5…')).toBeInTheDocument();

    fireEvent.click(optimize);
    expect(run.starts).toBe(1);

    await act(async () => { finish(); });
    await waitFor(() => expect(optimize).toHaveAttribute('aria-disabled', 'false'));
    expect(optimize.querySelector('.animate-spin')).toBeNull();
  });

  it('undoes in one press', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    fireEvent.click(screen.getByRole('button', { name: 'Optimize Images' }));
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

  it('reveals what it touched on undo, not the tab the author ran it from', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Locations/);
    fireEvent.click(screen.getAllByText('Harbor Steps').map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]')).find(Boolean)!);
    fireEvent.click(screen.getByRole('button', { name: 'Optimize Images' }));
    await waitFor(() => expect(ctx().locations[0].backgroundImage).toBe(WEBP));
    openEditorTab(/Entities/);

    await act(async () => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ctx().worldOverview.thumbnail).toBe(PNG);
    expect(shownEditorTab()).toMatch(/Overview/);
  });
});
