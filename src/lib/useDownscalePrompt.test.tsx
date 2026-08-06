import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { World } from '@/types';

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(() => 'progress-toast'), {
    update: vi.fn(),
    dismiss: vi.fn(),
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
