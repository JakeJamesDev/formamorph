import type { DocSection } from '@/lib/docs/docsIndex';
import { isLaterPart } from '@/lib/docs/docsReader';
import { WIKI_HOME_URL, wikiPageUrl } from '@/lib/helpTopics';

/** Where Open Wiki goes: the address, and the docs page it names, or null for the wiki home. */
export interface WikiTarget {
  url: string;
  page: string | null;
}

/** A page's title without the emoji that leads it, as a sentence names the page. */
export function pageNameOf(title: string): string {
  return title.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '');
}

/** The wiki page and heading of the section the reader shows, or the wiki home with no section open. A later part of a split section goes to its heading, which has no part anchor. */
export function wikiTarget(section: DocSection | null): WikiTarget {
  if (!section) return { url: WIKI_HOME_URL, page: null };
  const id = isLaterPart(section) ? section.id.replace(/-part-\d+$/, '') : section.id;
  return { url: wikiPageUrl(id), page: section.page };
}
