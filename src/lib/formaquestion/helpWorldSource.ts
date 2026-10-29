/**
 * A world item as an answer names it: a source beside the guide sections. The session, the follow-up
 * history and the AI Context trace carry it the same way they carry a section.
 */
import type { DocSection } from '@/lib/docs/docsIndex';

/** The kinds of world item a source can name. */
export type WorldItemKind = 'entity' | 'location' | 'item' | 'trait' | 'stat' | 'script' | 'tool' | 'dictionary' | 'prompt';

export interface WorldSource {
  kind: 'world';
  worldKind: WorldItemKind;
  id: string;
  /** The name a player sees. */
  name: string;
}

/** What an answer lists as its source: a guide section or a world item. */
export type AnswerSource = DocSection | WorldSource;

export const isWorldSource = (source: { id: string } | WorldSource): source is WorldSource => 'worldKind' in source;

/** One key per source, for a full section or its trace form; a world id and a section id never meet. */
export const sourceKey = (source: { id: string } | WorldSource): string => (isWorldSource(source) ? `${source.worldKind}:${source.id}` : source.id);

/** The sources that are guide sections. */
export const docSectionsOf = (sources: readonly AnswerSource[]): DocSection[] => sources.filter((source): source is DocSection => !isWorldSource(source));
