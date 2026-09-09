import type { ContentLink } from '@/types';

/** What a world's copy is, where it follows a source at all. A copy with no record is an independent
 *  copy and has no state — the editor shows it nothing. */
export type ContentLinkState = 'linked' | 'local-replacement';

/** The words every surface uses for each state, so the row tip and the header label cannot drift. */
export const CONTENT_LINK_LABELS: Record<ContentLinkState, string> = {
  linked: 'Linked',
  'local-replacement': 'Local replacement',
};

/** One field of a record a hand-edited or later-version world may have written as anything at all. */
const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/**
 * The state to show beside a world's copy, or null for an independent copy.
 *
 * A record has to name what it follows — a library item or a published listing. A record carrying only a
 * display name or only the replacement flag identifies nothing, so it reads as independent rather than as
 * a link to something unnamed.
 */
export function contentLinkState(link: ContentLink | undefined | null): ContentLinkState | null {
  if (!link || (!text(link.libraryId) && !text(link.sourceId))) return null;
  return link.localReplacement ? 'local-replacement' : 'linked';
}

/** The source's display name, or null when the record carries none. An id is never shown in its place. */
export function contentLinkSourceName(link: ContentLink | undefined | null): string | null {
  return link ? text(link.sourceName) : null;
}

/**
 * Drop a `link` that is not a record. A hand-edited world, an older file, or a future one can put anything
 * there, and a non-record has no fields to read at all.
 *
 * Only the container is checked. The fields inside are left exactly as written — including keys this
 * version does not know, so a world saved by a later version keeps whatever it wrote — and the readers
 * above are the ones that decide what a field is worth. Returns the same reference when there is nothing
 * to drop, so a second run is a no-op.
 */
export function normalizeLinkedItem<T extends object>(item: T): T {
  if (!('link' in item)) return item;
  const link = (item as { link?: unknown }).link;
  if (link !== null && typeof link === 'object' && !Array.isArray(link)) return item;
  const { link: _drop, ...rest } = item as T & { link?: unknown };
  return rest as T;
}
