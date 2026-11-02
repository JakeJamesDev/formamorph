# 10: Editor Data Wording

Status: done
Blocked by: 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: split decisions on World-Editor-Traits, then a rewrite under fixed rules.

## What to build

Check each page's structure, then rewrite these pages under the Writing Guide: [World-Editor-Stats](../../../../docs/World-Editor-Stats.md), [World-Editor-Items](../../../../docs/World-Editor-Items.md), [World-Editor-Traits](../../../../docs/World-Editor-Traits.md).

**Structure first.** Assess World-Editor-Traits for a split: it runs over 4,000 words. Split a page when it serves readers who come for different tasks, such as play vs authoring or setup vs reference; word count alone never splits a page. Send each proposed split (the page, the new pages, and the reader task of each) to the spec session and wait for its ruling. Land the ruled splits before the rewrite, so the rewrite covers the new pages. Every page also gets a readability check: headings a reader can scan, steps as lists, no section that buries its point.

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Spec: Implementation Decisions, "Structure check", "Wording pass", "Headings and anchors".

## Acceptance criteria

- [x] Each page over 4,000 words has a recorded split decision here: the ruling, or "no split" with the one reader task it serves. World-Editor-Traits (7,800 words) split, spec-session ruling: Traits keeps "make the traits a player or an entity has, and control when they are on" (5,800 words, Custom Persona stays); the new World-Editor-Blueprints takes "share one trait across several entities" (2,200 words). Stats (2,900) and Items (2,500) are under 4,000 and serve one reader task each: no split.
- [x] A split page's new pages are in the sidebar and Home, and every anchor table that named a moved heading points at its new page. Sidebar and Home rows added; Glossary, World-Editor-Placeholders, World-Editor-Stats and two help cases repointed; grep finds no `World-Editor-Traits#` link to a moved heading.
- [x] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here. Before: 136 on three pages (93 em-dash, 30 long-sentence, 6 term-character, 5 figurative, 1 filler, 1 ellipsis). After: 124 on four pages, all on keyword and route HTML comments (Q20 false positives).
- [x] Control names take the exact casing of the on-screen label. Add buttons follow Q12 with labels read from the adapters (`Add to Traits`, `Add to Stats`, `Add Item`); `Unlocked by` from `traitGateLine.ts`.
- [x] Product terms match "Controlled product terms". "No one owns it" and "the people here" now name entities.
- [x] Paragraphs are short and steps are scannable lists. Long paragraphs on Traits, Stats and Items became lists; the turn order is a numbered list.
- [x] No fact changed: a diff read finds no new claim, limit or default. Diff read against Base.
- [x] A renamed heading updates every anchor table that names it; the docs tests are green. No heading renamed; moved headings keep their wording. `npx vitest run src/lib/docs` plus the help-case tests: 333 passed. H3 headings are not index sections, so the new cases key Detach and overrides to `#links`.

## Landed

Help cases (Q19): a page-blind subagent wrote the new questions. Blind recall `blueprints-b1`, `blueprints-b2` and baseline `world-editor-blueprints-1`, `world-editor-blueprints-2` were added verbatim. `traits-b3` moved to the new page. Traits keeps two blind (`traits-b1`, `traits-b2`) and two baseline (`world-editor-traits-1`, `world-editor-traits-2`) cases, so the spare Traits questions were not added. No baseline run (Q6).

**Not verified**: nothing.

**For you**:
- The new [World Editor: Blueprints](../../../../docs/World-Editor-Blueprints.md) page and its 🔗 icon in the sidebar.
- Glossary rows for Link (`reads the Blueprint live`) keep a figurative "live", and the Global Stat and Global Trait rows say "No one owns it". Glossary belongs to ticket 20.
- [World-Editor-Placeholders.md](../../../../docs/World-Editor-Placeholders.md) still writes "Select **+**, then **Add Blueprints Group**" with a bare glyph (Q12). That page belongs to ticket 12; this ticket changed only its anchor.
