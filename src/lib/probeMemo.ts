/**
 * Session-scoped memory of which optional probe URLs an endpoint has already 404'd. The LM Studio
 * native lists (`/api/v0/models`, `/api/v1/models`) are probed by several features, and the browser
 * logs every 404 to the console — on a non-LM-Studio endpoint that reads as a stream of errors. A
 * 404 is a stable fact about an origin, so each URL is asked once per session and skipped after.
 *
 * Only conclusive absence is recorded. Network errors, auth failures and 5xx stay unrecorded — a down
 * or guarded server says nothing about which APIs it has, and recording them would break the
 * reachability recheck.
 */

const absent = new Set<string>();

/** The statuses that prove an API is not at a URL. A server with the path but not this API refuses the
 *  method or the content type rather than 404ing: LM Studio answers Ollama's `POST /api/show` with 415. */
const ABSENT_STATUSES: readonly number[] = [404, 405, 415];

/** Whether `url` already proved absent this session (so the probe should be skipped). */
export function probeKnownAbsent(url: string): boolean {
  return absent.has(url);
}

/**
 * Record a probe outcome for `url`, marking it absent for the rest of the session when the answer is
 * conclusive. Pass `body` where the probe already parsed one: a backend may answer a foreign path with
 * HTTP 200 and an error payload (LM Studio does this on `GET /props`), which is an absence too, so a
 * status code alone cannot identify a source.
 */
export function recordProbeStatus(url: string, status: number, body?: unknown): void {
  if (ABSENT_STATUSES.includes(status) || carriesError(body)) absent.add(url);
}

/** True when a parsed body is an error payload rather than an answer. */
function carriesError(body: unknown): boolean {
  return !!body && typeof body === 'object' && 'error' in body;
}

/** Test-only: forget everything. */
export function resetProbeMemo(): void {
  absent.clear();
}
