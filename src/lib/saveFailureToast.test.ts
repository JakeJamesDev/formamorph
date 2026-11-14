// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import { linkToast } from './linkToast';
import { toastSaveFailure, STORAGE_FULL } from './saveFailureToast';
import type { World } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));
vi.mock('./linkToast', () => ({ linkToast: vi.fn(), toastError: vi.fn() }));

const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
const world = { worldOverview: { name: 'Fen' } } as unknown as World;

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(linkToast).mockClear();
});

describe('toastSaveFailure', () => {
  it('offers Export World when the storage is full', async () => {
    await toastSaveFailure(quota, world);
    expect(linkToast).toHaveBeenCalledWith(expect.arrayContaining([STORAGE_FULL]), 'Export World', expect.any(Function), expect.anything());
  });

  it('states the reason in place of Export World for a Supporter Copy', async () => {
    await toastSaveFailure(quota, world, "You can't export a Supporter world");
    expect(linkToast).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("You can't export a Supporter world."), { autoClose: false });
  });
});
