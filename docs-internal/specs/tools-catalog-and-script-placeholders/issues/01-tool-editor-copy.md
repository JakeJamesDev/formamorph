# 01: Tool Editor Copy

Status: ready-for-human
Status note: landed as 3b2b0e08 + 4cd2353b; the footer carries a tab hint per the spec's ruling, and the in-browser look is covered by jsdom tests, not checked in the preview.
Base: bdb99575
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Rationale: four copy changes in one modal with existing tests that assert the old text; no new state.

## What to build

A Tool author reads exact helper lines in the Tool editor. The Description hint says what the field is for and no longer lists the outline headings. The lookup's match hint sits under the whole lookup row, full width, and names what each source searches. The save footer names each fix in one sentence, built from the draft problems, using the same wording the tab shows inline for that problem, with an unnamed parameter named by its position. The boolean parameter type reads **True/False**; the stored value stays `boolean`.

## Acceptance criteria

- [ ] Description hint reads "Tells the AI what the Tool does and when to call it"
- [ ] Match hint renders once under the lookup grid, per source, naming entities, locations, dictionary names and keywords, or memories
- [ ] Footer joins one verb phrase per problem with "and"; an unnamed parameter reads "Name parameter N"; the lookup phrase equals the Handler tab's inline text
- [ ] Tab-strip problem marks stay
- [ ] Boolean type label reads True/False; saved Tools with boolean parameters load unchanged
- [ ] Tools tab and Settings modal tests assert the new text; each fails when its change is reverted
- [ ] Four gates green, `graphify update .` run, In-Progress changelog entry added
