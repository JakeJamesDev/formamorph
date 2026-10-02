/** The guide's sections as the help search sources name them: one heading line each, changelog left out. */
import { CHANGELOG_PAGE, type DocSection, type DocsIndex } from '@/lib/docs/docsIndex';

export interface GuideSection {
  section: DocSection;
  /** The page title, the headings above the section, then its own, as one line. */
  line: string;
  /** Every part of a split section, in order, when this is its first part; the section alone otherwise. */
  parts: DocSection[];
  /** Part 2 or later of a split section. */
  laterPart: boolean;
}

const cache = new WeakMap<DocsIndex, GuideSection[]>();

/** A heading without the emoji or marker in front of its first word. */
const bare = (name: string) => name.replace(/^[^\p{L}\p{N}]+/u, '');

/** Every guide section of the index, in contents order. */
export function guideSections(index: DocsIndex): GuideSection[] {
  const known = cache.get(index);
  if (known) return known;
  const later = new Set<string>();
  const sections: GuideSection[] = [];
  for (const page of index.contents()) {
    if (page.page === CHANGELOG_PAGE) continue;
    for (const { id } of page.sections) {
      const parts = index.get([id]);
      if (parts.length === 0) continue;
      const laterPart = later.has(id);
      if (!laterPart) parts.slice(1).forEach((part) => later.add(part.id));
      const [section] = parts;
      const line = [...new Set([page.title, ...section.trail, section.heading].map(bare))].join(' › ');
      sections.push({ section, line, parts, laterPart });
    }
  }
  cache.set(index, sections);
  return sections;
}
