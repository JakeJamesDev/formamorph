/**
 * The Docs Index over the docs bundled into this build. Load it through `loadDocsIndex`, so the docs stay
 * out of the start bundle. The `docs-index` query (see `vite.config.js`) trims the changelog at build time.
 */
import sidebar from '../../../docs/_Sidebar.md?raw';
import { createDocsIndex, type DocsIndex } from './docsIndex';
import { pageNameOf, type DocsPages } from './docsChecks';

// Glob patterns must be literals; `NON_GUIDE_PAGES` lists the same three pages and a test keeps them equal.
const FILES = import.meta.glob<string>(
  ['../../../docs/*.md', '!**/_Sidebar.md', '!**/Design-System.md', '!**/Writing-Guide.md'],
  { query: '?docs-index', import: 'default', eager: true },
);

/** The bundled docs pages by wiki page name. */
export const BUNDLED_DOCS: DocsPages = Object.fromEntries(
  Object.entries(FILES).map(([path, markdown]) => [pageNameOf(path), markdown]),
);

let index: DocsIndex | null = null;

/** The index over {@link BUNDLED_DOCS}, built on first use. */
export function bundledDocsIndex(): DocsIndex {
  index ??= createDocsIndex({ pages: BUNDLED_DOCS, sidebar });
  return index;
}
