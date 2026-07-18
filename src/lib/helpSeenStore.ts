/**
 * Which help topics the user has already opened, so `HelpButton` can nudge once and then go quiet.
 * Per-topic and permanent: a topic drops its nudge the first time its pop-out is opened, and stays quiet.
 *
 * Local-only UI state — never part of a world or save. Writes are try/catch'd because private-mode
 * browsers throw on `setItem`; a failed write just means the nudge shows again next session.
 */

const SEEN_KEY = 'FORMAMORPH_helpSeen';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

/** Whether this topic's pop-out has been opened before. */
export function isHelpSeen(topicId: string): boolean {
  return read().has(topicId);
}

/** Record that a topic's pop-out was opened. No-op when it already was. */
export function markHelpSeen(topicId: string): void {
  const seen = read();
  if (seen.has(topicId)) return;
  seen.add(topicId);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* private mode — the nudge just returns next session */
  }
}
