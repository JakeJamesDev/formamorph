import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { fakeDataUrl } from '@/test/mediaFixture';
import { formatMediaBytes, storedBytes } from '@/lib/mediaIndex';
import type { World } from '@/types';

/** Optimize Images runs from the Media tab header and is one history step. */

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
const PNG = fakeDataUrl('image/png', 9_000, 'p');
const WEBP = fakeDataUrl('image/webp', 3_000, 'w');
// A test that sets `hold` keeps the run open at 2 of 5 images until `hold` settles.
const run = vi.hoisted(() => ({ starts: 0, hold: null as Promise<void> | null, signal: undefined as AbortSignal | undefined }));
vi.mock('@/lib/useDownscalePrompt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/useDownscalePrompt')>();
  return {
    ...actual,
    useDownscalePrompt: () => ({
      ...actual.useDownscalePrompt(),
      promptWorld: async (world: World, onProgress?: (done: number, total: number) => void, signal?: AbortSignal) => {
        run.starts += 1;
        run.signal = signal;
        if (run.hold) { onProgress?.(2, 5); await run.hold; }
        return {
          ...world,
          worldOverview: { ...world.worldOverview, thumbnail: WEBP },
          entities: world.entities.map((e) => ({ ...e, images: [{ data: WEBP }] })),
          locations: world.locations.map((l) => ({ ...l, images: [{ data: WEBP }] })),
          dictionaries: world.dictionaries.map((d) => ({ ...d, thumbnail: WEBP })),
        };
      },
    }),
  };
});

const WORLD = benchEditorWorld({
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: PNG, bgm: null,
    systemPrompt: '', tags: [],
  },
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, images: [{ data: PNG }] }],
  entities: [{ id: 'resident', name: 'Odd Wick', images: [{ data: PNG }], locations: ['harbor'] }],
  dictionaries: [{ id: 'lore', name: 'Fen Lore', entries: [], thumbnail: PNG }],
} as Partial<World>);

const renderMedia = (mode: 'simple' | 'advanced') => {
  const bench = renderWorldEditorBench(WORLD, mode);
  openEditorTab(/^Media$/);
  return bench;
};
const optimizeButton = () => screen.getByRole('button', { name: 'Optimize Images' });

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
  run.starts = 0;
  run.hold = null;
  run.signal = undefined;
});

describe('Optimize Images', () => {
  it.each(['simple', 'advanced'] as const)('is the last icon of the Media header and runs in %s', async (mode) => {
    const { ctx } = renderMedia(mode);
    const header = document.querySelector<HTMLElement>('[data-media-header]')!;
    expect(header.lastElementChild).toBe(optimizeButton());

    fireEvent.click(optimizeButton());
    await waitFor(() => expect(ctx().worldOverview.thumbnail).toBe(WEBP));
  });

  it('is gone from every other tab', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    expect(screen.queryByRole('button', { name: 'Optimize Images' })).toBeNull();
  });

  it('spins and reports progress in its tooltip while it runs, and ignores a second click', async () => {
    let finish!: () => void;
    run.hold = new Promise<void>((resolve) => { finish = resolve; });
    renderMedia('advanced');
    const optimize = optimizeButton();
    expect(optimize.querySelector('.animate-spin')).toBeNull();

    fireEvent.click(optimize);
    await waitFor(() => expect(optimize).toHaveAttribute('aria-disabled', 'true'));
    expect(optimize.querySelector('.animate-spin')).not.toBeNull();
    // The name stays put while the tooltip carries the count.
    expect(optimizeButton()).toBe(optimize);
    await userEvent.hover(optimize);
    expect(await screen.findByText('Optimizing 2/5…')).toBeInTheDocument();

    fireEvent.click(optimize);
    expect(run.starts).toBe(1);

    await act(async () => { finish(); });
    await waitFor(() => expect(optimize).toHaveAttribute('aria-disabled', 'false'));
    expect(optimize.querySelector('.animate-spin')).toBeNull();
  });

  it('writes the dictionary thumbnail back with the other images, and the cards show the new sizes', async () => {
    const { ctx } = renderMedia('simple');
    const dictionaries = screen.getByRole('region', { name: 'Dictionaries' });
    expect(dictionaries).toHaveTextContent(formatMediaBytes(storedBytes(PNG)));

    fireEvent.click(optimizeButton());
    await waitFor(() => expect(ctx().dictionaries[0].thumbnail).toBe(WEBP));
    expect(ctx().worldOverview.thumbnail).toBe(WEBP);
    expect(ctx().entities[0].images).toEqual([{ data: WEBP }]);
    expect(ctx().locations[0].images?.[0]?.data).toBe(WEBP);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Dictionaries' })).toHaveTextContent(formatMediaBytes(storedBytes(WEBP))));
    expect(screen.getByRole('region', { name: 'Dictionaries' })).not.toHaveTextContent(formatMediaBytes(storedBytes(PNG)));
  });

  it('undoes in one press', async () => {
    const { ctx } = renderMedia('advanced');
    fireEvent.click(optimizeButton());
    await waitFor(() => expect(ctx().locations[0].images?.[0]?.data).toBe(WEBP));
    expect(ctx().worldOverview.thumbnail).toBe(WEBP);
    expect(ctx().entities[0].images).toEqual([{ data: WEBP }]);
    expect(ctx().dictionaries[0].thumbnail).toBe(WEBP);

    await act(async () => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ctx().worldOverview.thumbnail).toBe(PNG);
    expect(ctx().entities[0].images).toEqual([{ data: PNG }]);
    expect(ctx().locations[0].images?.[0]?.data).toBe(PNG);
    expect(ctx().dictionaries[0].thumbnail).toBe(PNG);

    // Nothing earlier is left to undo.
    await act(async () => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ctx().worldOverview.thumbnail).toBe(PNG);
    await act(async () => { fireEvent.keyDown(document.body, { key: 'y', ctrlKey: true }); });
    expect(ctx().worldOverview.thumbnail).toBe(WEBP);
    expect(ctx().dictionaries[0].thumbnail).toBe(WEBP);
    expect(ctx().locations[0].images?.[0]?.data).toBe(WEBP);
  });

  it('cancels when the editor closes mid-run and writes nothing', async () => {
    let finish!: () => void;
    run.hold = new Promise<void>((resolve) => { finish = resolve; });
    const { ctx, unmount } = renderMedia('advanced');
    fireEvent.click(optimizeButton());
    await waitFor(() => expect(optimizeButton()).toHaveAttribute('aria-disabled', 'true'));
    expect(run.signal?.aborted).toBe(false);

    unmount();
    expect(run.signal?.aborted).toBe(true);
    await act(async () => { finish(); });
    expect(ctx().worldOverview.thumbnail).toBe(PNG);
    expect(ctx().dictionaries[0].thumbnail).toBe(PNG);
  });

  it('reveals what it touched on undo, not the tab the author ran it from', async () => {
    const { ctx } = renderMedia('advanced');
    fireEvent.click(optimizeButton());
    await waitFor(() => expect(ctx().locations[0].images?.[0]?.data).toBe(WEBP));
    openEditorTab(/Entities/);

    await act(async () => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ctx().worldOverview.thumbnail).toBe(PNG);
    expect(shownEditorTab()).toMatch(/Overview/);
  });
});
