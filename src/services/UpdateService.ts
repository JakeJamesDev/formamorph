// Desktop update detection: reads the GitHub Releases API, filters by channel, and compares the newest
// eligible release against the running version. Never throws — resolves to `{ success, error }` like the
// community services (see WorldStorageService). On a network failure it falls back to the last cached
// release list so an offline launch can still show the last-known state.

import { APP_VERSION } from '@/lib/version';
import { isNewer, parseVersion } from '@/lib/updates/semver';
import type { UpdateChannel } from '@/contexts/settingsDefaults';

const REPO = 'JakeJamesDev/formamorph';
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases`;
const CACHE_KEY = 'FORMAMORPH_updateCache';

/** The verbose changelog, auto-published to the repo wiki from docs/. Linked from the update/changelog popouts. */
export const WIKI_CHANGELOG_URL = `https://github.com/${REPO}/wiki/Changelog`;

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

/** How many recent releases the changelog popouts show. */
export const RECENT_CHANGELOG_COUNT = 3;

/** The `major.minor` a tag belongs to (e.g. `v2.1.1` → `2.1`); falls back to the raw tag when unparseable. */
function minorKey(tag: string): string {
  const v = parseVersion(tag);
  return v ? `${v.major}.${v.minor}` : tag.replace(/^v/, '');
}

/** Fold one release's body under its patch label. The version is its own `### <tag>` heading (rendered flush,
 *  like the `## <minor>` group header above it), and category headers (`### Added`) are demoted to bold caption
 *  labels on their own line beneath it (indented via CSS). Pure. */
function foldRelease(tag: string, body: string): string {
  const text = (body || '_No release notes._').trim();
  const demoted = text.replace(/^#{1,6}\s+(.+?)\s*$/gm, '**$1**'); // category headers → bold caption labels
  return `### ${tag}\n\n${demoted}`;
}

/** Combine the most recent `count` releases into one markdown doc, folding patch versions under a single
 *  `## <major.minor>` header (each patch a bold label) so the popouts read as a short, grouped history rather
 *  than one big header per patch. Pure. */
export function buildRecentChangelog(releases: GithubRelease[], count = RECENT_CHANGELOG_COUNT): string {
  const groups: { minor: string; items: GithubRelease[] }[] = [];
  for (const r of releases.slice(0, count)) {
    const minor = minorKey(r.tag_name);
    const group = groups.find((g) => g.minor === minor);
    if (group) group.items.push(r);
    else groups.push({ minor, items: [r] });
  }
  return groups
    .map((g) => `## ${g.minor}\n\n${g.items.map((r) => foldRelease(r.tag_name, r.body)).join('\n\n')}`)
    .join('\n\n');
}

/** Pick the newest release eligible for `channel` and decide whether it's newer than `currentVersion`.
 *  GitHub returns releases newest-first, so the first match is the latest. `changelog` covers the most recent
 *  few releases (see buildRecentChangelog). Pure — no I/O. */
export function parseReleases(
  releases: GithubRelease[],
  channel: UpdateChannel,
  currentVersion: string,
): UpdateCheckResult {
  const eligible = releases.filter((r) => !r.draft && (channel === 'prerelease' || !r.prerelease));
  const latest = eligible[0];
  if (!latest) return { available: false };
  const latestVersion = latest.tag_name;
  const changelog = buildRecentChangelog(eligible);
  return { available: isNewer(latestVersion, currentVersion), latestVersion, changelog, release: latest };
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
