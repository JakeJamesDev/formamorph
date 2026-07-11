// Minimal semver parse + compare for the desktop auto-updater. Tags are `vX.Y.Z` (optionally `-prerelease`).
// Deliberately tiny — we only need "is the latest release newer than what's running?", not full semver range
// logic. A release outranks its own prerelease (1.0.0 > 1.0.0-beta.1).

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  /** The `-…` suffix (e.g. `beta.1`), or null for a final release. */
  prerelease: string | null;
}

/** Parse a `vX.Y.Z[-pre]` string; returns null when it doesn't match (so callers can treat it as "no update"). */
export function parseVersion(v: string): SemVer | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(v.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease: m[4] ?? null };
}

/** Returns negative when a precedes b, 0 when equal, positive when a follows b. Unparseable input compares
 *  as equal (so a bad tag never reads as newer). */
export function compareSemver(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (const k of ['major', 'minor', 'patch'] as const) {
    if (pa[k] !== pb[k]) return pa[k] < pb[k] ? -1 : 1;
  }
  // Same core version: a final release outranks a prerelease of it.
  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && pb.prerelease && pa.prerelease !== pb.prerelease) {
    return pa.prerelease < pb.prerelease ? -1 : 1;
  }
  return 0;
}

/** True when `latest` is strictly newer than `current`. */
export function isNewer(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}
