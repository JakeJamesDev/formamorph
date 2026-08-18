import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { World } from '@/types';

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(() => 'progress-toast'), {
    update: vi.fn(),
    dismiss: vi.fn(),
    info: vi.fn(),
  }),
}));
vi.mock('./imageOptimWorkerClient', () => ({
  measureInWorker: vi.fn(),
  encodeInWorker: vi.fn(),
}));
import { toast } from 'react-toastify';
import { measureInWorker, encodeInWorker } from './imageOptimWorkerClient';
import { useDownscalePrompt } from './useDownscalePrompt';

// The hook under test is rendered through a host so the choice dialog actually mounts.
let api: ReturnType<typeof useDownscalePrompt>;
const Host = () => {
  api = useDownscalePrompt();
  return api.dialog;
};

const OVERSIZED = { w: 5000, h: 5000, bytes: 5_000_000 };

const world = {
  id: 'w',
  worldOverview: { thumbnail: 'data:image/png;base64,big' },
  entities: [],
  locations: [],
} as unknown as World;

describe('useDownscalePrompt progress toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(measureInWorker).mockResolvedValue(OVERSIZED);
    vi.mocked(encodeInWorker).mockResolvedValue('data:image/webp;base64,small');
  });

  it('promptWorld without a caller onProgress reports through the shared toast', async () => {
    // Hold the encode open so the toast is observable mid-run.
    let finishEncode!: () => void;
    vi.mocked(encodeInWorker).mockImplementation(
      () => new Promise((resolve) => { finishEncode = () => resolve('data:image/webp;base64,small'); }),
    );

    render(<Host />);
    let run!: Promise<World | null>;
    act(() => { run = api.promptWorld(world); });

    fireEvent.click(await screen.findByText('Downscale'));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Optimizing images… 0/1', expect.anything()));
    expect(toast.dismiss).not.toHaveBeenCalled();

    await act(async () => finishEncode());
    const result = await run;
    expect(result?.worldOverview.thumbnail).toBe('data:image/webp;base64,small');
    expect(toast.update).toHaveBeenCalledWith('progress-toast', expect.objectContaining({
      render: 'Optimizing images… 1/1',
      progress: 1,
    }));
    expect(toast.dismiss).toHaveBeenCalledWith('progress-toast');
  });

  it('promptWorld with a caller onProgress leaves the toast to the caller', async () => {
    render(<Host />);
    const onProgress = vi.fn();
    let run!: Promise<World | null>;
    act(() => { run = api.promptWorld(world, onProgress); });

    fireEvent.click(await screen.findByText('Downscale'));
    await run;
    expect(onProgress).toHaveBeenCalledWith(1, 1);
    expect(toast).not.toHaveBeenCalled();
  });

  it('promptImage reports through the shared toast', async () => {
    render(<Host />);
    let run!: Promise<string>;
    act(() => {
      run = api.promptImage('data:image/png;base64,big', { maxDim: 1024, maxBytes: 600_000 });
    });

    fireEvent.click(await screen.findByText('Downscale'));
    await expect(run).resolves.toBe('data:image/webp;base64,small');
    expect(toast).toHaveBeenCalledWith('Optimizing images… 0/1', expect.anything());
    expect(toast.dismiss).toHaveBeenCalledWith('progress-toast');
  });
});

/**
 * What the popup promises has to be what accepting it does. The encoder keeps any image a lossless WebP copy
 * would grow — every JPEG, in practice — so an offer counting those toward its shrink estimate describes a
 * run that cannot happen, and a run that quietly kept them leaves the same offer standing next time.
 */
describe('useDownscalePrompt — the Optimize offer counts only what converts', () => {
  const worldWith = (thumbnail: string, images: string[] = []) => ({
    id: 'w',
    worldOverview: { thumbnail },
    entities: images.length ? [{ id: 'e1', name: 'Maren', images }] : [],
    locations: [],
  } as unknown as World);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(measureInWorker).mockResolvedValue(OVERSIZED);
    vi.mocked(encodeInWorker).mockResolvedValue('data:image/webp;base64,small');
  });

  it('offers no Optimize at all when every oversized image is a photo', async () => {
    render(<Host />);
    act(() => { void api.promptWorld(worldWith('data:image/jpeg;base64,big')); });

    expect(await screen.findByText('Downscale')).toBeInTheDocument();
    // Optimize would keep every one of them, so offering it is offering a button that does nothing.
    expect(screen.queryByText('Optimize')).toBeNull();
    expect(screen.queryByText(/lossless WebP/)).toBeNull();
  });

  it('counts an image it cannot convert at the bytes it already has', async () => {
    render(<Host />);
    act(() => {
      void api.promptWorld(worldWith('data:image/jpeg;base64,big', ['data:image/png;base64,big']));
    });

    await screen.findByText('Optimize');
    // 5 MB of PNG estimates down to ~4.25 MB; the 5 MB JPEG is kept whole. Counting both as convertible
    // would have promised 8.5 MB.
    expect(screen.getByText(/~9\.3 MB, no quality loss/)).toBeInTheDocument();
    // And the claim counts the same one image the estimate does — "converts them" would promise two.
    expect(screen.getByText(/Optimize converts 1 of them to lossless WebP/)).toBeInTheDocument();
  });

  it('promises the whole set only when the whole set converts', async () => {
    render(<Host />);
    act(() => {
      void api.promptWorld(worldWith('data:image/png;base64,big', ['data:image/bmp;base64,big']));
    });

    await screen.findByText('Optimize');
    expect(screen.getByText(/Optimize converts them to lossless WebP/)).toBeInTheDocument();
  });

  it('reports the images an accepted run kept, so the standing offer reads as a fact', async () => {
    // The grow-guard's own answer: the encoder hands the original back rather than a larger WebP.
    vi.mocked(encodeInWorker).mockImplementation((url: string) => Promise.resolve(url));
    render(<Host />);
    let run!: Promise<World | null>;
    act(() => { run = api.promptWorld(worldWith('data:image/png;base64,big')); });

    fireEvent.click(await screen.findByText('Optimize'));
    await run;

    expect(toast.info).toHaveBeenCalledWith('Kept 1 image as it was — WebP wouldn’t make it smaller.');
  });

  it('says nothing after a run that converted what it offered to convert', async () => {
    render(<Host />);
    let run!: Promise<World | null>;
    act(() => { run = api.promptWorld(worldWith('data:image/png;base64,big')); });

    fireEvent.click(await screen.findByText('Optimize'));
    await run;

    expect(toast.info).not.toHaveBeenCalled();
  });

  it('leaves a Downscale run’s report alone — it is not a conversion offer', async () => {
    vi.mocked(encodeInWorker).mockImplementation((url: string) => Promise.resolve(url));
    render(<Host />);
    let run!: Promise<World | null>;
    act(() => { run = api.promptWorld(worldWith('data:image/png;base64,big')); });

    fireEvent.click(await screen.findByText('Downscale'));
    await run;

    expect(toast.info).not.toHaveBeenCalled();
  });
});
