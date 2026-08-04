import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(() => 'progress-toast'), {
    update: vi.fn(),
    dismiss: vi.fn(),
  }),
}));
import { toast } from 'react-toastify';
import { withOptimizeProgress } from './optimizeProgress';

describe('withOptimizeProgress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens at 0/total, updates per tick, and dismisses on success', async () => {
    const result = await withOptimizeProgress(3, async (tick) => {
      tick(1);
      tick(2);
      return 'done';
    });

    expect(result).toBe('done');
    expect(toast).toHaveBeenCalledWith('Optimizing images… 0/3', { autoClose: false, progress: 0 });
    expect(toast.update).toHaveBeenNthCalledWith(1, 'progress-toast', {
      render: 'Optimizing images… 1/3',
      progress: 1 / 3,
    });
    expect(toast.update).toHaveBeenNthCalledWith(2, 'progress-toast', {
      render: 'Optimizing images… 2/3',
      progress: 2 / 3,
    });
    expect(toast.dismiss).toHaveBeenCalledWith('progress-toast');
  });

  it('dismisses the toast when the run throws', async () => {
    await expect(withOptimizeProgress(2, async () => {
      throw new Error('encode failed');
    })).rejects.toThrow('encode failed');
    expect(toast.dismiss).toHaveBeenCalledWith('progress-toast');
  });
});
