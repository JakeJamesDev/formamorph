/**
 * Session-scoped memory of which optional probe URLs an endpoint has already 404'd. The LM Studio
 * native lists (`/api/v0/models`, `/api/v1/models`) are probed by several features, and the browser
 * logs every 404 to the console — on a non-LM-Studio endpoint that reads as a stream of errors. A
 * 404 is a stable fact about an origin, so each URL is asked once per session and skipped after.
 *
 * Only conclusive absence (HTTP 404) is recorded. Network errors stay unrecorded — a down server
 * says nothing about which APIs it has, and recording them would break the reachability recheck.
 */

const absent = new Set<string>();

/** Whether `url` already answered 404 this session (so the probe should be skipped). */
export function probeKnownAbsent(url: string): boolean {
  return absent.has(url);
}

/** Record a probe outcome for `url`: 404 marks it absent for the rest of the session. */
export function recordProbeStatus(url: string, status: number): void {
  if (status === 404) absent.add(url);
}

/** Test-only: forget everything. */
export function resetProbeMemo(): void {
  absent.clear();
}
