import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const plannedSize = vi.fn<(choice: string) => Promise<number | null>>();
vi.mock('./characterMentionsApp', () => ({ characterMentions: () => ({ plannedSize }) }));

const { usePlannedDownloadSize } = await import('./usePlannedDownloadSize');

describe('usePlannedDownloadSize', () => {
  it('reads null, not an unhandled rejection, when the size lookup fails', async () => {
    plannedSize.mockRejectedValueOnce(new Error('manifest unreachable'));
    const { result } = renderHook(() => usePlannedDownloadSize('auto', true));
    await waitFor(() => expect(plannedSize).toHaveBeenCalled());
    await Promise.resolve();
    expect(result.current).toBeNull();
  });

  it('drops the old size while a new choice is read, and when it turns inactive', async () => {
    plannedSize.mockResolvedValueOnce(140e6);
    const { result, rerender } = renderHook(({ choice, active }) => usePlannedDownloadSize(choice, active), {
      initialProps: { choice: 'small' as 'small' | 'big', active: true },
    });
    await waitFor(() => expect(result.current).toBe(140e6));

    plannedSize.mockReturnValueOnce(new Promise(() => {}));
    rerender({ choice: 'big', active: true });
    expect(result.current).toBeNull();

    rerender({ choice: 'big', active: false });
    expect(result.current).toBeNull();
  });
});
