/**
 * The section vectors of the semantic help source: one embedding per guide section, built with
 * `npm run build:help-vectors` into `sectionVectors.json`. Each vector holds the hash of the text it came
 * from, so a section the docs changed since drops out until the next build.
 */
import { contentHash } from '@/lib/contentHash';
import type { DocSection, DocsIndex } from '@/lib/docs/docsIndex';
import { EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';
import { guideSections } from './guideSections';

export interface SectionVectorsFile {
  /** The embedding model every vector comes from. */
  model: string;
  /** The values in one vector. */
  dims: number;
  sections: {
    id: string;
    /** The hash of the section text the vector was built from. */
    hash: string;
    /** The vector as base64 of little-endian float32. */
    vector: string;
  }[];
}

/** A guide section with the text it is embedded as: its heading line, then its markdown. */
export interface SectionText {
  section: DocSection;
  text: string;
  hash: string;
}

/** The text of every guide section as the embedder reads it. The model reads the start of a long text. */
export function sectionTexts(index: DocsIndex): SectionText[] {
  return guideSections(index).map(({ section, line }) => {
    const text = `${line}\n\n${section.markdown}`;
    return { section, text, hash: contentHash(text) };
  });
}

export function encodeVector(vector: Float32Array): string {
  const bytes = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
  return btoa(String.fromCharCode(...bytes));
}

export function decodeVector(base64: string): Float32Array {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Float32Array(bytes.buffer);
}

export interface SectionEntry {
  id: string;
  section: DocSection;
  vector: Float32Array;
}

/**
 * The sections the file holds a current vector for. None when the file is from another model. A section
 * whose text changed since the build, or that the file does not hold, is left out.
 */
export function sectionEntries(index: DocsIndex, file: SectionVectorsFile): SectionEntry[] {
  if (file.model !== EMBEDDING_MODEL_ID) return [];
  const held = new Map(file.sections.map((entry) => [entry.id, entry]));
  return sectionTexts(index).flatMap(({ section, hash }) => {
    const entry = held.get(section.id);
    return entry?.hash === hash ? [{ id: section.id, section, vector: decodeVector(entry.vector) }] : [];
  });
}
