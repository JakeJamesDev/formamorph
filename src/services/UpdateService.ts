// Desktop update detection: reads the GitHub Releases API, filters by channel, and compares the newest
// eligible release against the running version. Never throws — resolves to `{ success, error }` like the
// community services (see WorldStorageService). On a network failure it falls back to the last cached
// release list so an offline launch can still show the last-known state.

import { APP_VERSION } from '@/lib/version';
import { isNewer } from '@/lib/updates/semver';
import type { UpdateChannel } from '@/contexts/settingsDefaults';

const REPO = 'JakeJamesDev/formamorph';
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases`;
const CACHE_KEY = 'FORMAMORPH_updateCache';

export interface GithubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}
export interface GithubRelease {
  tag_name: string;
  name: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
  assets: GithubAsset[];
  published_at: string;
}

export interface UpdateCheckResult {
  available: boolean;
  latestVersion?: string;
  /** Release notes markdown of the newest eligible release (present even when up to date). */
  changelog?: string;
  release?: GithubRelease;
}
export interface UpdateCheckResponse {
  success: boolean;
  error?: string;
  result?: UpdateCheckResult;
  /** True when the result came from the offline cache rather than a live fetch. */
  fromCache?: boolean;
}

/** Fetch raw text, routing through the desktop CORS-free bridge when present, else the plain fetch. */
async function fetchRaw(url: string): Promise<{ ok: boolean; status: number; body: string }> {
  const headers = { Accept: 'application/vnd.github+json' };
  if (typeof window !== 'undefined' && window.formamorphDesktop?.fetch) {
    return window.formamorphDesktop.fetch({ url, headers });
  }
  const res = await fetch(url, { headers });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

function writeCache(releases: GithubRelease[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), releases }));
  } catch {
    // Best-effort cache; ignore quota/serialization failures.
  }
}

function readCache(): GithubRelease[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { releases?: GithubRelease[] };
    return Array.isArray(parsed.releases) ? parsed.releases : null;
  } catch {
    return null;
  }
}

/** Pick the newest release eligible for `channel` and decide whether it's newer than `currentVersion`.
 *  GitHub returns releases newest-first, so the first match is the latest. Pure — no I/O. */
export function parseReleases(
  releases: GithubRelease[],
  channel: UpdateChannel,
  currentVersion: string,
): UpdateCheckResult {
  const eligible = releases.filter((r) => !r.draft && (channel === 'prerelease' || !r.prerelease));
  const latest = eligible[0];
  if (!latest) return { available: false };
  const latestVersion = latest.tag_name;
  if (!isNewer(latestVersion, currentVersion)) {
    return { available: false, latestVersion, changelog: latest.body, release: latest };
  }
  return { available: true, latestVersion, changelog: latest.body, release: latest };
}

/** Check GitHub for an update on `channel`. Never rejects. */
export async function checkForUpdate(
  channel: UpdateChannel,
  currentVersion: string = APP_VERSION,
): Promise<UpdateCheckResponse> {
  try {
    const raw = await fetchRaw(RELEASES_URL);
    if (!raw.ok) throw new Error(`GitHub responded ${raw.status}`);
    const releases = JSON.parse(raw.body) as GithubRelease[];
    if (!Array.isArray(releases)) throw new Error('Unexpected releases payload');
    writeCache(releases);
    return { success: true, result: parseReleases(releases, channel, currentVersion) };
  } catch (error) {
    const cached = readCache();
    if (cached) {
      return { success: true, fromCache: true, result: parseReleases(cached, channel, currentVersion) };
    }
    return { success: false, error: (error as Error).message };
  }
}
