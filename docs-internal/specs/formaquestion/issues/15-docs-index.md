# 15: Docs Index

Status: done
Base: 8a206765
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The app carries the player docs and can search them with no network and no model. This is test seam 1 of the spec.

The Docs Index is a module with no React. It has three operations:

- **Contents:** every page with its sections, in sidebar order.
- **Search:** a question or keywords in, ranked sections out. Plain keyword ranking; heading matches count more than body matches. No embeddings.
- **Get:** sections by id, as markdown.

Rules:

- The docs are bundled as raw markdown at build time and load lazily, so the start bundle does not grow. The default worlds are bundled the same way; follow that precedent.
- A page splits into sections at its headings. A section id is the page name plus the heading anchor, made with the anchor function from ticket 01.
- Included: every player guide page, the world format reference, the glossary when it exists, and the released changelog sections of the current minor series (Q19).
- Excluded: the design system page, the writing guide, the sidebar file, the unreleased changelog section and older changelog sections.
- A section too long for a small context is split at its sub-headings, or cut with a marker when it has none. State the size limit as one named constant.
- The same index works in the web build, the desktop build and the Android build.

No UI in this ticket. The proof is the test suite and a measured bundle.

Recommended model rationale: the ranking and the section-size rule decide answer quality for every later ticket; the code itself is small.

## Acceptance criteria

- [x] Fixture markdown splits into the expected sections with the expected ids
- [x] Search ranks a heading match above a body-only match, and returns nothing for a query with no match
- [x] Get returns the exact markdown of a section
- [x] A test over the real bundled docs proves every page yields at least one section and no excluded page is present
- [x] Only the current minor series of released changelog sections is present
- [x] The index is in its own lazy chunk; the size of that chunk and the unchanged start chunk are stated in the commit body from a real build
- [x] Each guard is proven to bite
- [x] Four gates green

## Comments

**Built.** Code is in `src/lib/docs/`:

| File | Role |
|---|---|
| `docsIndex.ts` | `createDocsIndex`: contents, search, get. `SECTION_CHAR_LIMIT` = 6,000 chars |
| `sectionParts.ts` | Splits an oversized section into parts at block boundaries |
| `changelogSlice.ts` | Keeps the released sections of the newest minor series; the build runs it |
| `bundledDocsIndex.ts` | The docs of this build, through the `?docs-index` query in `vite.config.js` |
| `loadDocsIndex.ts` | The one entry point; loads the index from its own chunk |

**Rulings from the spec session.** An oversized section with no sub-headings splits into parts, not a truncation. Parts break at top-level list items, paragraphs, fences or table rows; a split table repeats its header; an oversized list item splits at its nested items and repeats its lead line. Part 1 keeps `<page>#<anchor>`, later parts get `-part-N`, labels read "Heading (Part N)". Get on a base id returns every part in order. A cut with a marker is only the fallback for a block with nothing to split at.

**Index-only ids.** Part ids and the changelog's release ids (`Changelog#-312--released-2026-09-30`) are not wiki anchors. Nothing that links the wiki may use them.

**Real docs.** 33 pages, 500 sections, no section cut. Changelog 3.1.0 "Added" (78 KB) is 15 parts.

**Search.** BM25 over the body; a heading word adds 4, a word in a heading above adds 1; the score is multiplied by the square of the share of query words matched. Plurals fold to singular; filler words drop; link targets are not searched.

**Bundle.** Start chunk unchanged: `index-CYeWn402.js` 8,024.90 kB, with no docs text or code in it. Index chunk in a build that imports the loader: `bundledDocsIndex-*.js` 528.47 kB (165.90 kB gzip).

**Guards bite.** Each mutation below was run against the suite, then restored:

| Mutation | Tests failed |
|---|---|
| Heading weight 0 | 2 |
| No zero-score filter | 3 |
| No plural fold | 2 |
| No coverage factor, or a linear one | 1 |
| Search link targets | 1 |
| Split at `###` | 3 |
| Base id returns one part | 4 |
| No "(Part N)" label | 1 |
| No table header repeat | 2 |
| No nested list split | 2 |
| Keep every changelog series | 3 |
| Bundle Design-System | 2 |
| Close a cut `~~~` fence with ```` ``` ```` | 1 |
| Split inside a code fence | 2 |
| Static import of the bundled index in the loader | 1 |

**Review fold-in.** The fence rule and the link regex now come from `headingAnchors.ts`, and a cut `~~~` fence closes with `~~~`. `pageNameOf` replaces three copies of the path slice. Internal helpers are no longer exported. A test keeps every production module but the loader from naming the bundled index, and the loader may name it only through `import()`. Kept as ruled: the series comes from the newest released changelog block, not from the app version.

**No changelog line.** Nothing shows to a player until ticket 16.
