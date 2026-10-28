// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WorldStorageService from '@/services/WorldStorageService';

const flags = vi.hoisted(() => ({ COMMUNITY_ENABLED: true }));
vi.mock('@/lib/featureFlags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/featureFlags')>()),
  get COMMUNITY_ENABLED() { return flags.COMMUNITY_ENABLED; },
}));
import { supporterMascotListingsOf, useSupporterMascotListings } from './useSupporterMascotListings';

const API = 'https://api.example';

afterEach(() => {
  vi.restoreAllMocks();
  flags.COMMUNITY_ENABLED = true;
});

describe('supporterMascotListingsOf', () => {
  it('keeps only Supporter-only rows, with the thumbnail URL when one is stored', () => {
    const rows = [
      { id: 7, name: 'Nova', supporter_only: true, thumbnail_file: 'nova.webp' },
      { id: 8, name: 'Plain', supporter_only: false, thumbnail_file: 'plain.webp' },
      { id: 'n9', name: 'Bare', supporter_only: true },
      { id: 10, supporter_only: true },
      'junk',
    ];
    expect(supporterMascotListingsOf(rows, API)).toEqual([
      { id: '7', name: 'Nova', thumbnailUrl: `${API}/thumbnails/nova.webp` },
      { id: 'n9', name: 'Bare', thumbnailUrl: null },
    ]);
  });
});

describe('useSupporterMascotListings', () => {
  it('reads the first Mascot catalog page once', async () => {
    const read = vi.spyOn(WorldStorageService, 'fetchRemoteWorlds').mockResolvedValue({
      success: true, data: [{ id: 7, name: 'Nova', supporter_only: true }], pagination: undefined, total: 1,
    });
    const { result } = renderHook(() => useSupporterMascotListings());
    await waitFor(() => expect(result.current.map((listing) => listing.name)).toEqual(['Nova']));
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0][7]).toBe('mascot');
  });

  it('reads nothing and lists nothing in a build without Community Creations', async () => {
    flags.COMMUNITY_ENABLED = false;
    const read = vi.spyOn(WorldStorageService, 'fetchRemoteWorlds');
    const { result } = renderHook(() => useSupporterMascotListings());
    await Promise.resolve();
    expect(read).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('lists nothing when the read fails', async () => {
    const read = vi.spyOn(WorldStorageService, 'fetchRemoteWorlds').mockResolvedValue({ success: false, error: 'down', data: [] });
    const { result } = renderHook(() => useSupporterMascotListings());
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
