import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { fakeDataUrl } from '@/test/mediaFixture';
import { blankItem } from '@/lib/items';
import { IMAGE_CAPS } from '@/lib/imageSlots';

/** A real Optimize Images run over an oversized item image: the scan, the dialog, the walk and the write. Only the encoder is stubbed. */

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

vi.mock('@/lib/imageOptimWorkerClient', () => ({
  encodeInWorker: vi.fn(),
  measureInWorker: vi.fn(),
  supportsWebp: () => true,
  terminateImageOptimWorker: vi.fn(),
}));

import { encodeInWorker, measureInWorker } from '@/lib/imageOptimWorkerClient';

const THUMBNAIL = fakeDataUrl('image/webp', 900, 'B');
const ITEM_IMAGE = fakeDataUrl('image/webp', 900, 'C');
const SHRUNK = fakeDataUrl('image/webp', 100, 'D');

const WORLD = benchEditorWorld({
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: THUMBNAIL, bgm: null,
    systemPrompt: '', tags: [],
  },
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: [],
  items: [{ ...blankItem('lantern', 'Tin Lantern'), images: [{ data: ITEM_IMAGE }] }],
});

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
  vi.clearAllMocks();
  vi.mocked(measureInWorker).mockResolvedValue({ w: 4000, h: 4000, bytes: 900_000 });
  vi.mocked(encodeInWorker).mockResolvedValue(SHRUNK);
});

describe('Optimize Images over an item image', () => {
  it('counts it, re-encodes it under the entity cap, and undoes it with the rest of the run', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/^Media$/);

    fireEvent.click(screen.getByRole('button', { name: 'Optimize Images' }));
    expect(await screen.findByText(/This world has 2 images larger than recommended/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Downscale' }));

    await waitFor(() => expect(ctx().items[0].images).toEqual([{ data: SHRUNK }]));
    expect(ctx().worldOverview.thumbnail).toBe(SHRUNK);
    expect(vi.mocked(encodeInWorker).mock.calls.find(([url]) => url === ITEM_IMAGE)?.[1]).toBe(IMAGE_CAPS.entity.maxDim);

    await act(async () => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ctx().items[0].images).toEqual([{ data: ITEM_IMAGE }]);
    expect(ctx().worldOverview.thumbnail).toBe(THUMBNAIL);
  });

  it('writes a Body\'s Custom Image back and undoes it with the rest of the run', async () => {
    const backdrop = { kind: 'image' as const, image: { data: ITEM_IMAGE } };
    const { ctx } = renderWorldEditorBench({
      ...WORLD,
      items: [],
      bodies: [{ id: 'imp', name: 'Imp', aspect: 2, entries: [], backdrop }],
    }, 'advanced');
    openEditorTab(/^Media$/);

    fireEvent.click(screen.getByRole('button', { name: 'Optimize Images' }));
    await screen.findByText(/This world has 2 images larger than recommended/);
    fireEvent.click(screen.getByRole('button', { name: 'Downscale' }));

    await waitFor(() => expect(ctx().bodies[0].backdrop).toEqual({ kind: 'image', image: { data: SHRUNK } }));
    expect(ctx().bodies[0].aspect).toBe(2);

    await act(async () => { fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true }); });
    expect(ctx().bodies[0].backdrop).toEqual(backdrop);
    expect(ctx().worldOverview.thumbnail).toBe(THUMBNAIL);
  });
});
