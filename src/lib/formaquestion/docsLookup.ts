/**
 * The docs lookup: the one function a help request offers, so the model picks the docs sections it reads.
 * It is app-internal and no Tool (ADR-0009): it has no catalog entry, no preset and no handler, and the
 * help session runs it through the tool loop with the executor made here.
 */
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import type { ToolCallResult } from '@/lib/tools/toolRunner';
import type { OfferedFunction } from '@/lib/tools/toolSchema';

/** The default most lookup calls one help question runs. */
export const DOCS_LOOKUP_CALL_LIMIT = 3;

/** The most ids an unknown-id result lists. */
const NEAR_ID_LIMIT = 5;

const DEFAULT_SEARCH_LIMIT = 5;

export const DOCS_LOOKUP: OfferedFunction = {
  id: 'docs-lookup',
  name: 'read_guide',
  description: 'Returns the text of guide sections. Pass `search` to find sections by words, or pass `sections` to read sections by the ids you have seen.',
  params: [
    { name: 'sections', type: 'string', description: 'Section ids, each written Page#section, separated by commas.', required: false, options: [] },
    { name: 'search', type: 'string', description: 'Words to search the guide for.', required: false, options: [] },
  ],
};

export interface DocsLookupOptions {
  /** The most characters of docs text the calls of one question return together. */
  budget?: number;
  /** The most sections one search returns. */
  searchLimit?: number;
  /** The sections the request already holds. A call never returns them again. */
  held?: readonly DocSection[];
}

export interface DocsLookup {
  execute: ToolExecutor<OfferedFunction>;
  /** The sections the calls returned so far, in the order the model got them. */
  fetched(): DocSection[];
}

/** A later part of a split section. Its base id returns it, so the id lists leave it out. */
function isLaterPart(index: DocsIndex, id: string): boolean {
  const base = id.replace(/-part-\d+$/, '');
  return base !== id && index.get([base]).some((section) => section.id === id);
}

/** The section ids of the guide by page, without later parts. An id with no `#` is a page's text above its first heading. */
function baseSectionIds(index: DocsIndex): { page: string; ids: string[] }[] {
  return index.contents().map(({ page, sections }) => ({
    page,
    ids: sections.map((section) => section.id).filter((id) => !isLaterPart(index, id)),
  }));
}

/** A page or section name as written by a model, folded to the form of an anchor without its leading hyphens. */
const fold = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, '-').replace(/^-+/, '');

/** The words of an id, for ranking the ids near an unknown one. */
const idWords = (id: string): string[] => id.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

const failed = (error: string): ToolCallResult => ({ text: JSON.stringify({ error }), failure: 'arguments' });

const quoted = (text: string): string => JSON.stringify(text);

/** A section as a lookup request and a lookup result carry it: its text under its id. */
export const sectionBlock = (section: DocSection): string => `<section id="${section.id}">\n${section.markdown}\n</section>`;

/** A lookup for one help question. It keeps what it returned, so the calls of the question share one budget. */
export function createDocsLookup(index: DocsIndex, options: DocsLookupOptions = {}): DocsLookup {
  const { budget = Infinity, searchLimit = DEFAULT_SEARCH_LIMIT, held = [] } = options;
  const pages = baseSectionIds(index);
  const heldIds = new Set(held.map((section) => section.id));
  const fetched: DocSection[] = [];
  let size = 0;

  const pageNamed = (name: string) => pages.find(({ page }) => fold(page) === fold(name));

  /** A written id in two parts: the page before its `#` or `:`, when it names one, and the folded section name. */
  const parts = (written: string) => {
    const at = written.search(/[#:]/);
    return at < 0
      ? { named: false, page: undefined, section: fold(written) }
      : { named: true, page: pageNamed(written.slice(0, at)), section: fold(written.slice(at + 1)) };
  };

  /** The ids whose section name is `section`, on the given pages. */
  const idsNamed = (section: string, among: typeof pages): string[] =>
    among.flatMap(({ page, ids }) => ids.filter((id) => fold(id.slice(page.length + 1)) === section));

  /** The id a model wrote, as the index knows it; null when no one section fits it. */
  const resolve = (written: string): string | null => {
    if (index.get([written]).length > 0) return written;
    const { named, page, section } = parts(written);
    // A page name alone is the page's first section.
    const whole = named ? undefined : pageNamed(written);
    if (whole) return whole.ids[0] ?? null;
    const matches = idsNamed(section, named ? (page ? [page] : []) : pages);
    return matches.length === 1 ? matches[0] : null;
  };

  /** The ids near an unknown one: its page's sections by shared words, or the search hits for its words. */
  const nearIds = (written: string): string[] => {
    const words = idWords(written);
    const { page, section } = parts(written);
    if (page) {
      const shared = (id: string) => idWords(id.slice(page.page.length)).filter((word) => words.includes(word)).length;
      return page.ids
        .map((id, order) => ({ id, order, shared: shared(id) }))
        .sort((a, b) => b.shared - a.shared || a.order - b.order)
        .slice(0, NEAR_ID_LIMIT)
        .map((entry) => entry.id);
    }
    const sameName = idsNamed(section, pages);
    if (sameName.length > 1) return sameName.slice(0, NEAR_ID_LIMIT);
    return index.search(words.join(' '), NEAR_ID_LIMIT).map((hit) => hit.id).filter((id) => !isLaterPart(index, id));
  };

  /**
   * Adds the sections that are new to the result, in order, up to the first one that does not fit the
   * budget; sorts the rest into the notes. The parts of a split section thus never arrive without the first.
   */
  const take = (sections: readonly DocSection[], out: { text: string[]; have: string[]; over: string[] }) => {
    let full = false;
    for (const section of sections) {
      if (heldIds.has(section.id)) { out.have.push(section.id); continue; }
      full ||= size + section.markdown.length > budget;
      if (full) { out.over.push(section.id); continue; }
      heldIds.add(section.id);
      fetched.push(section);
      size += section.markdown.length;
      out.text.push(sectionBlock(section));
    }
  };

  const execute: ToolExecutor<OfferedFunction> = async (_lookup, argumentsText) => {
    let raw: unknown;
    try {
      raw = JSON.parse(argumentsText);
    } catch {
      return failed('Arguments must be a JSON object.');
    }
    if (typeof raw !== 'object' || raw === null) return failed('Arguments must be a JSON object.');
    const { sections, search } = raw as { sections?: unknown; search?: unknown };
    const written = (Array.isArray(sections) ? sections.filter((id): id is string => typeof id === 'string') : typeof sections === 'string' ? sections.split(/[,\n]/) : [])
      .map((id) => id.trim().replace(/^["'`]+|["'`]+$/g, '').trim())
      .filter(Boolean);
    const words = typeof search === 'string' ? search.trim() : '';
    if (written.length === 0 && !words) return failed('Pass `sections` with section ids, or `search` with words.');

    const out = { text: [] as string[], have: [] as string[], over: [] as string[] };
    const notes: string[] = [];
    for (const id of written) {
      const known = resolve(id);
      if (known) { take(index.get([known]), out); continue; }
      const near = nearIds(id);
      notes.push(`No section has the id ${quoted(id)}.${near.length > 0 ? ` Ids near it: ${near.join(', ')}.` : ''}`);
    }
    if (words) {
      const hits = index.search(words, searchLimit + heldIds.size).filter((section) => !heldIds.has(section.id)).slice(0, searchLimit);
      if (hits.length === 0) notes.push(`No new section matches ${quoted(words)}.`);
      take(hits, out);
    }
    if (out.have.length > 0) notes.push(`You already have: ${out.have.join(', ')}.`);
    if (out.over.length > 0) notes.push(`Over the size limit of one question, not returned: ${out.over.join(', ')}.`);
    return { text: [...out.text, ...notes].join('\n\n') };
  };

  return { execute, fetched: () => [...fetched] };
}
