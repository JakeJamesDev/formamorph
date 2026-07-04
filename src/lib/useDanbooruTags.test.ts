import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDanbooruTags } from './useDanbooruTags';

vi.mock('./danbooruTags', () => ({
  loadDanbooruTags: vi.fn(async () => ['1girl', 'solo', 'long hair']),
}));

describe('useDanbooruTags', () => {
  it('loads the tag list into state when enabled', async () => {
    const { result } = renderHook(() => useDanbooruTags());
    expect(result.current).toEqual([]); // empty until the promise resolves
    await waitFor(() => expect(result.current).toEqual(['1girl', 'solo', 'long hair']));
  });

  it('stays empty when disabled', async () => {
    const { result } = renderHook(() => useDanbooruTags(false));
    await Promise.resolve();
    expect(result.current).toEqual([]);
  });
});
