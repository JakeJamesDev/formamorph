# 15: Docs Index

Status: ready-for-agent
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

- [ ] Fixture markdown splits into the expected sections with the expected ids
- [ ] Search ranks a heading match above a body-only match, and returns nothing for a query with no match
- [ ] Get returns the exact markdown of a section
- [ ] A test over the real bundled docs proves every page yields at least one section and no excluded page is present
- [ ] Only the current minor series of released changelog sections is present
- [ ] The index is in its own lazy chunk; the size of that chunk and the unchanged start chunk are stated in the commit body from a real build
- [ ] Each guard is proven to bite
- [ ] Four gates green
