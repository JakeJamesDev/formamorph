/**
 * The reset instant as a local weekday and time, such as "Monday at 5:00 PM". `timeZone` defaults to the
 * viewer's zone; null for a missing or unreadable instant.
 */
export function formatResetTime(resetAt: string | null, timeZone?: string): string | null {
  if (!resetAt) return null;
  const date = new Date(resetAt);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString('en-US', { weekday: 'long', timeZone });
  // NFKC folds the narrow no-break space that newer ICU puts before AM/PM into a plain space.
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).normalize('NFKC');
  return `${day} at ${time}`;
}
