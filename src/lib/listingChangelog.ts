/**
 * The Listing Changelog's logic, with no React in it: what order entries read in, what a draft has to
 * say before it is worth sending, which panel opens first, and how to tell a server that has never heard
 * of any of this from a listing that simply has no history yet.
 *
 * The last of those is the reason this is a module rather than three helpers inside the modal. The client
 * and the community server ship separately, so every surface has to answer "is this feature here at all?"
 * the same way, and answer it from the payload rather than from a version number nobody sends.
 */

import type { DownloadState } from "@/lib/downloadState";

/** One Changelog Entry, as the server stores and serves it. */
export interface ChangelogEntry {
  id: string;
  world_id: string;
  title: string;
  body: string;
  /** The author's own date for the update, `YYYY-MM-DD`. Not when the row was written. */
  entry_date: string;
  created_at: string;
  updated_at: string;
}

/** What the entry popup edits: the three authored fields, before an entry has an identity of its own. */
export interface ChangelogDraft {
  title: string;
  body: string;
  /** `YYYY-MM-DD`, as an `<input type="date">` reads and writes it. */
  date: string;
}

/** Long enough for a title with a version and a phrase in it, short enough to stay on one line. */
export const CHANGELOG_TITLE_MAX = 120;

/** What a comment holds, because the same editor writes both. */
export const CHANGELOG_BODY_MAX = 4000;

/** The server's per-listing ceiling, repeated here so the Add control can go quiet before it is refused. */
export const CHANGELOG_MAX_ENTRIES = 100;

/** Which panel the details window's right column is showing. */
export type ChangelogTab = 'changelog' | 'comments';

/**
 * Whether a string names a day that exists.
 *
 * The shape alone accepts `2026-02-31`; round-tripping through Date is what catches it, because an
 * impossible day comes back as a different one.
 *
 * @param value - The candidate, as a date input hands it over
 * @returns Whether it is a real calendar date
 */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Today, as a date input wants it.
 *
 * Read off the local calendar rather than the ISO string, which is UTC — an author writing in the evening
 * west of Greenwich would otherwise be handed tomorrow's date as their default.
 *
 * @param now - The moment to read, for tests
 * @returns `YYYY-MM-DD`
 */
export function todayForDateInput(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * An entry's date, readable.
 *
 * Built from the parts rather than parsed, because `new Date('2026-08-01')` is midnight *UTC* — which is
 * the previous evening anywhere west of Greenwich, so the reader would be shown a day the author never
 * wrote. The server's timestamp formatter is no use here either: this is a bare calendar date, not an
 * instant, and it has no zone to correct for.
 *
 * @param value - `YYYY-MM-DD`
 * @returns A local-format date, or the input unchanged when it is not one
 */
export function formatChangelogDate(value: string): string {
  if (!isCalendarDate(value)) return value;

  const [year, month, day] = value.split('-').map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/**
 * Entries newest first, by the author's own date, with the later-written one first among a day's ties.
 *
 * Sorted here as well as in the SQL because the panel keeps working after it has spliced a new entry into
 * the list it already holds, and that entry can be dated anywhere in the history.
 *
 * @param entries - The entries in any order
 * @returns A new array, newest first
 */
export function sortChangelogEntries(entries: ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? 1 : -1;

    return (a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1;
  });
}

/**
 * The first thing wrong with a draft, or null when it is ready to send.
 *
 * The same rules the server applies, so a refusal is something the author reads before the request rather
 * than after it. The server still checks — this only keeps the round trip off the obvious cases.
 *
 * @param draft - What the popup holds
 * @returns The message to show, or null
 */
export function changelogDraftError(draft: ChangelogDraft): string | null {
  const title = draft.title.trim();
  const body = draft.body.trim();

  if (!title) return 'Give the entry a title.';
  if (title.length > CHANGELOG_TITLE_MAX) return `Titles are ${CHANGELOG_TITLE_MAX} characters at most.`;
  if (!body) return 'Say what changed.';
  if (body.length > CHANGELOG_BODY_MAX) return `Entries are ${CHANGELOG_BODY_MAX} characters at most.`;
  if (!isCalendarDate(draft.date)) return 'Pick a date for the entry.';

  return null;
}

/**
 * The changelog on a fetched listing, or null when the server did not serve one.
 *
 * The whole of graceful degradation. A server that has this feature answers the opt-in flag with an
 * array — empty when the listing has no history — so an absent field means the deploy predates the
 * feature, and every surface reading this hides itself rather than showing an empty tab or an error.
 *
 * @param world - The listing as the single-listing GET returned it
 * @returns The entries newest first, or null when the server does not support changelogs
 */
export function changelogOf(world: { changelog?: unknown } | null | undefined): ChangelogEntry[] | null {
  if (!world || !Array.isArray(world.changelog)) return null;

  return sortChangelogEntries(world.changelog as ChangelogEntry[]);
}

/**
 * Which panel the details window opens on.
 *
 * Comments, except for the one reader with a question the changelog is the answer to: somebody holding a
 * copy the listing has moved on from, deciding right now whether to take the update.
 *
 * @param entries - The listing's changelog, or null when there is none
 * @param downloadState - What the reader's own copies say (see `lib/downloadState`)
 * @returns The tab to open on
 */
export function defaultChangelogTab(
  entries: ChangelogEntry[] | null,
  downloadState: DownloadState,
): ChangelogTab {
  if (!entries || entries.length === 0) return 'comments';

  return downloadState === 'update' ? 'changelog' : 'comments';
}
