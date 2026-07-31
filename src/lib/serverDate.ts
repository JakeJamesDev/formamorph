/**
 * Parse a timestamp that came from the community server.
 *
 * The server stores SQLite `CURRENT_TIMESTAMP` values (`YYYY-MM-DD HH:MM:SS`), which are UTC but carry
 * no zone marker. Handed straight to `new Date` those are read as *local* time, so every server date
 * displays off by the viewer's offset. Anything already bearing a zone — an ISO string, which is what
 * the app writes for its own local timestamps — is passed through untouched.
 *
 * @param timestamp - A timestamp from the server, or a locally-written ISO string
 * @returns The instant, or null if it cannot be parsed
 */
export function parseServerDate(timestamp: string): Date | null {
  const zoned = /[TZ]|[+-]\d{2}:?\d{2}$/.test(timestamp)
    ? timestamp
    : `${timestamp.replace(' ', 'T')}Z`;

  const date = new Date(zoned);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A server timestamp as a readable local date and time; empty when it cannot be parsed. */
export function formatServerDateTime(timestamp: string): string {
  return parseServerDate(timestamp)?.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }) ?? '';
}
