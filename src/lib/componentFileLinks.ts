/**
 * The relationship metadata an exported component file carries.
 *
 * A component file holds the component and what it is connected to. It never holds a world: an
 * association names a world listing, and the importer decides whether to install or link anything.
 */

import type { WorldAssociation } from '@/lib/compatibleWorlds';
import { linkText as text } from '@/lib/contentLink';
import type { ContentLink } from '@/types';

/** Where a component file came from, so an importer can reconnect it. */
export interface ComponentFileSource {
  /** The published listing behind the component, where it has one. */
  sourceId?: string;
  /** The library item the file was written from. Local to the machine that wrote it, so an importer
   *  matches it against its own library only, which is what makes a re-import there restore the link. */
  libraryId?: string;
  /** The source's name as it read when the file was written. Display only, never identity. */
  sourceName?: string;
  /** The revision the exported copy held. */
  sourceRevision?: string;
}

/** The two relationship blocks a component file adds to its content. Both are additive and optional. */
export interface ComponentFileLinks {
  source?: ComponentFileSource;
  /** The worlds the component declares itself compatible with, by listing id. */
  associations?: WorldAssociation[];
}

/** Whether a file says anything about where it came from or what it suits. A file that says nothing has
 *  no relationships to review, so importing it is the whole of the import. */
export const hasComponentLinks = (links: ComponentFileLinks): boolean =>
  !!links.source || !!links.associations?.length;

/** The source block for a world copy's link record, or undefined where the copy follows nothing. */
export function sourceFromLink(link: ContentLink | undefined | null): ComponentFileSource | undefined {
  if (!link) return undefined;
  const source: ComponentFileSource = {
    ...(text(link.sourceId) ? { sourceId: link.sourceId } : {}),
    ...(text(link.libraryId) ? { libraryId: link.libraryId } : {}),
    ...(text(link.sourceName) ? { sourceName: link.sourceName } : {}),
    ...(text(link.sourceRevision) ? { sourceRevision: link.sourceRevision } : {}),
  };
  return source.sourceId || source.libraryId ? source : undefined;
}

/** Read the relationship blocks back off a parsed file. Anything malformed reads as absent rather than
 *  as a relationship to something unnamed. */
export function readComponentFileLinks(raw: unknown): ComponentFileLinks {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;

  const rawSource = obj.source;
  let source: ComponentFileSource | undefined;
  if (rawSource && typeof rawSource === 'object' && !Array.isArray(rawSource)) {
    const fields = rawSource as Record<string, unknown>;
    const read: ComponentFileSource = {
      ...(text(fields.sourceId) ? { sourceId: text(fields.sourceId)! } : {}),
      ...(text(fields.libraryId) ? { libraryId: text(fields.libraryId)! } : {}),
      ...(text(fields.sourceName) ? { sourceName: text(fields.sourceName)! } : {}),
      ...(text(fields.sourceRevision) ? { sourceRevision: text(fields.sourceRevision)! } : {}),
    };
    if (read.sourceId || read.libraryId) source = read;
  }

  const associations = Array.isArray(obj.associations)
    ? (obj.associations as unknown[]).flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const fields = row as Record<string, unknown>;
      const id = text(fields.id);
      if (!id) return [];
      return [{ id, name: text(fields.name) ?? 'Untitled world' } satisfies WorldAssociation];
    })
    : [];

  return { ...(source ? { source } : {}), ...(associations.length ? { associations } : {}) };
}
