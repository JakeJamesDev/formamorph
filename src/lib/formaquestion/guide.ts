import type { DocSection, DocsContentsPage, DocsIndex } from '@/lib/docs/docsIndex';
import { createDocsLinkResolver, sectionWithId, type DocsLinkResolver } from '@/lib/docs/docsReader';

/** What the Formaquestion window reads from a loaded Docs Index. Build it once per index. */
export interface Guide {
  index: DocsIndex;
  contents: DocsContentsPage[];
  /** A page's title as the player reads it. */
  titleOf: (page: string) => string;
  /** The section with exactly this id: one part of a split section, never all of them. */
  section: (id: string) => DocSection | null;
  resolve: DocsLinkResolver;
}

export function createGuide(index: DocsIndex): Guide {
  const contents = index.contents();
  const titles = new Map(contents.map((entry) => [entry.page, entry.title]));
  return {
    index,
    contents,
    titleOf: (page) => titles.get(page) ?? page,
    section: (id) => sectionWithId(index, id),
    resolve: createDocsLinkResolver(index),
  };
}
