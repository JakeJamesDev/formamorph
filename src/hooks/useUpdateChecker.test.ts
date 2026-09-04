import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GithubRelease } from '@/services/UpdateService';

const checkForUpdate = vi.hoisted(() => vi.fn());
vi.mock('@/services/UpdateService', async () => {
  const actual = await vi.importActual<typeof import('@/services/UpdateService')>('@/services/UpdateService');
  return { ...actual, checkForUpdate };
});

import { useUpdateChecker } from './useUpdateChecker';

type Shell = { Capacitor?: unknown };

const asset = (name: string) => ({ name, browser_download_url: `https://dl.test/${name}`, size: 1 });

/** A release carrying the Android pair, which is what the plugin needs handed to it. */
const release = (tag: string): GithubRelease => ({
  tag_name: tag,
  name: tag,
  body: 'notes',
  prerelease: false,
  draft: false,
  assets: [asset('Formamorph-android.apk'), asset('Formamorph-android.apk.sha512')],
  published_at: '2026-09-04T00:00:00Z',
});

/** The fake plugin, planted where Capacitor's native bridge injects the real one. */
function plantPlugin(over: Partial<Record<string, unknown>> = {}) {
  const plugin = {
    pending: vi.fn(async () => ({ version: null as string | null })),
    download: vi.fn(async () => {}),
    apply: vi.fn(async () => ({ needsPermission: false })),
    addListener: vi.fn(async () => ({ remove: async () => {} })),
    ...over,
  };
  (window as Shell).Capacitor = {
    isPluginAvailable: (name: string) => name === 'FormamorphUpdate',
    Plugins: { FormamorphUpdate: plugin },
  };
  return plugin;
}

beforeEach(() => {
  checkForUpdate.mockResolvedValue({
    success: true,
    result: { available: true, latestVersion: 'v9.9.9', changelog: 'notes', release: release('v9.9.9') },
  });
});

afterEach(() => {
  delete (window as Shell).Capacitor;
  vi.clearAllMocks();
});

describe('the update checker over the Android bridge', () => {
  it('offers the update once the check finds one', async () => {
    plantPlugin();

    const { result } = renderHook(() => useUpdateChecker('stable'));

    await waitFor(() => expect(result.current.state.phase).toBe('available'));
    expect(result.current.state.latestVersion).toBe('v9.9.9');
  });

  it('resumes at downloaded when the staged version is the one on offer', async () => {
    plantPlugin({ pending: vi.fn(async () => ({ version: '9.9.9' })) });

    const { result } = renderHook(() => useUpdateChecker('stable'));

    // No second download of a file already in the cache: it goes straight to the install offer.
    await waitFor(() => expect(result.current.state.phase).toBe('downloaded'));
  });

  it('still offers a download when the staged version is an older one', async () => {
    plantPlugin({ pending: vi.fn(async () => ({ version: '9.9.8' })) });

    const { result } = renderHook(() => useUpdateChecker('stable'));

    await waitFor(() => expect(result.current.state.phase).toBe('available'));
  });

  it('hands the plugin the release the check found', async () => {
    const plugin = plantPlugin();
    const { result } = renderHook(() => useUpdateChecker('stable'));
    await waitFor(() => expect(result.current.state.phase).toBe('available'));

    act(() => result.current.download());

    await waitFor(() => expect(plugin.download).toHaveBeenCalledWith({
      version: 'v9.9.9',
      url: 'https://dl.test/Formamorph-android.apk',
      sha512Url: 'https://dl.test/Formamorph-android.apk.sha512',
    }));
    expect(result.current.state.phase).toBe('downloading');
  });

  it('shows a failed download as an error, not a stalled progress bar', async () => {
    // What a mismatched checksum reaches the footer as: the plugin deletes the file and rejects.
    plantPlugin({ download: vi.fn(async () => { throw new Error('Checksum did not match'); }) });
    const { result } = renderHook(() => useUpdateChecker('stable'));
    await waitFor(() => expect(result.current.state.phase).toBe('available'));

    act(() => result.current.download());

    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    expect(result.current.state.error).toBe('Checksum did not match');
  });

  it('refuses a release with no Android download instead of calling the plugin', async () => {
    checkForUpdate.mockResolvedValue({
      success: true,
      result: {
        available: true,
        latestVersion: 'v9.9.9',
        changelog: 'notes',
        release: { ...release('v9.9.9'), assets: [asset('Formamorph-win.exe')] },
      },
    });
    const plugin = plantPlugin();
    const { result } = renderHook(() => useUpdateChecker('stable'));
    await waitFor(() => expect(result.current.state.phase).toBe('available'));

    act(() => result.current.download());

    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    expect(plugin.download).not.toHaveBeenCalled();
  });

  it('drives progress events into the download state', async () => {
    let progress: ((p: { received: number; total: number }) => void) | null = null;
    plantPlugin({
      addListener: vi.fn(async (event: string, cb: (p: never) => void) => {
        if (event === 'downloadProgress') progress = cb as (p: { received: number; total: number }) => void;
        return { remove: async () => {} };
      }),
    });
    const { result } = renderHook(() => useUpdateChecker('stable'));
    await waitFor(() => expect(progress).not.toBeNull());

    act(() => progress!({ received: 45, total: 90 }));

    expect(result.current.state.phase).toBe('downloading');
    expect(result.current.state.downloadPct).toBe(50);
  });

  it('keeps the install offer when Android has not been allowed to install yet', async () => {
    const plugin = plantPlugin({
      pending: vi.fn(async () => ({ version: '9.9.9' })),
      apply: vi.fn(async () => ({ needsPermission: true })),
    });
    const { result } = renderHook(() => useUpdateChecker('stable'));
    await waitFor(() => expect(result.current.state.phase).toBe('downloaded'));

    act(() => result.current.applyUpdate());

    // The plugin opened the unknown-sources setting rather than installing. That is not a failure, so the
    // Install button must survive for the tap that comes back and no error may replace it.
    await waitFor(() => expect(plugin.apply).toHaveBeenCalled());
    expect(result.current.state.phase).toBe('downloaded');
    expect(result.current.state.error).toBeUndefined();
  });

  it('shows a failed install as an error', async () => {
    plantPlugin({
      pending: vi.fn(async () => ({ version: '9.9.9' })),
      apply: vi.fn(async () => { throw new Error('The installer refused the file'); }),
    });
    const { result } = renderHook(() => useUpdateChecker('stable'));
    await waitFor(() => expect(result.current.state.phase).toBe('downloaded'));

    act(() => result.current.applyUpdate());

    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    expect(result.current.state.error).toBe('The installer refused the file');
  });
});

describe('the update checker with no bridge', () => {
  it('still checks, and download and apply do nothing', async () => {
    const { result } = renderHook(() => useUpdateChecker('stable'));
    await waitFor(() => expect(result.current.state.phase).toBe('available'));

    act(() => result.current.download());
    act(() => result.current.applyUpdate());

    // The browser has no installer. Nothing throws, and the offer is all the UI shows.
    expect(result.current.state.phase).toBe('downloading');
  });
});
