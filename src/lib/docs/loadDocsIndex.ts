import type { DocsIndex } from './docsIndex';

/** The Docs Index, loaded from its own chunk on first call. */
export function loadDocsIndex(): Promise<DocsIndex> {
  return import('./bundledDocsIndex').then((module) => module.bundledDocsIndex());
}
