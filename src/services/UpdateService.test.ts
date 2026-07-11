import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseReleases, checkForUpdate, type GithubRelease } from './UpdateService';

const rel = (tag: string, prerelease = false, draft = false, body = ''): GithubRelease => ({
  tag_name: tag,
  name: tag,
  body,
  prerelease,
  draft,
  assets: [],
  published_at: '2026-07-11T00:00:00Z',
});

describe('parseReleases', () => {
  it('stable channel ignores prereleases and drafts', () => {
    const releases = [rel('v2.3.0-beta.1', true), rel('v2.2.0-draft', false, true), rel('v2.1.0')];
    const r = parseReleases(releases, 'stable', '2.0.0');
    expect(r.available).toBe(true);
    expect(r.latestVersion).toBe('v2.1.0');
  });

  it('prerelease channel takes the newest including prereleases (still not drafts)', () => {
    const releases = [rel('v2.3.0-beta.1', true), rel('v2.1.0')];
    const r = parseReleases(releases, 'prerelease', '2.0.0');
    expect(r.available).toBe(true);
    expect(r.latestVersion).toBe('v2.3.0-beta.1');
  });

  it('is not-available when the newest eligible release is not newer', () => {
    const r = parseReleases([rel('v2.1.0', false, false, 'current notes')], 'stable', '2.1.0');
    expect(r.available).toBe(false);
    expect(r.latestVersion).toBe('v2.1.0');
    expect(r.changelog).toBe('current notes');
  });

  it('is not-available when there are no eligible releases', () => {
    expect(parseReleases([rel('v9.9.9', true)], 'stable', '2.0.0').available).toBe(false);
  });

  it('carries the release body as the changelog', () => {
    const r = parseReleases([rel('v2.2.0', false, false, '## What changed')], 'stable', '2.1.0');
    expect(r.changelog).toBe('## What changed');
  });
});

describe('checkForUpdate', () => {
  const stubFetch = (releases: unknown, ok = true, status = 200) =>
    vi.stubGlobal(
      'fetch',
      // Minimal Response-like shape; cast through unknown since we only touch ok/status/text.
      vi.fn(() => Promise.resolve({ ok, status, text: () => Promise.resolve(JSON.stringify(releases)) } as unknown as Response)),
    );

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('resolves success with a parsed available result and caches the raw releases', async () => {
    stubFetch([rel('v2.2.0', false, false, 'notes')]);
    const res = await checkForUpdate('stable', '2.1.0');
    expect(res.success).toBe(true);
    expect(res.result?.available).toBe(true);
    expect(res.result?.latestVersion).toBe('v2.2.0');
    expect(localStorage.getItem('FORMAMORPH_updateCache')).toContain('v2.2.0');
  });

  it('falls back to cache on a network failure', async () => {
    stubFetch([rel('v2.2.0')]);
    await checkForUpdate('stable', '2.1.0'); // seeds the cache
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const res = await checkForUpdate('stable', '2.1.0');
    expect(res.success).toBe(true);
    expect(res.fromCache).toBe(true);
    expect(res.result?.latestVersion).toBe('v2.2.0');
  });

  it('returns success:false when the fetch fails and there is no cache', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const res = await checkForUpdate('stable', '2.1.0');
    expect(res.success).toBe(false);
    expect(res.error).toBe('offline');
  });

  it('treats a non-200 response as a failure (with no cache)', async () => {
    stubFetch([], false, 503);
    const res = await checkForUpdate('stable', '2.1.0');
    expect(res.success).toBe(false);
    expect(res.error).toContain('503');
  });
});
