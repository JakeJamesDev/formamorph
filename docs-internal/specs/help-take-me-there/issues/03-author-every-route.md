# 03: Author every route

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Every how-to section in the player docs names its surface, or the ticket records why it has none.

- Each of the how-to sections (about 176) gets a route line, chosen from the surface ids. A section that describes no single surface (a concept, a cross-screen flow) gets none, and the ticket's Answer lists them with the reason.
- Route lines add no text to a section, so the AI Picks list should not move. The recall probe runs once on cloud before and after, and the Answer reports the two numbers.

Spec: Implementation → Route tags in the docs; Further Notes.

Recommended model rationale: mechanical authoring across many pages with a validation test as the net.

## Acceptance criteria

- [ ] Every how-to section carries a route or is listed in the Answer with a reason.
- [ ] The source test passes on every page.
- [ ] Recall probe before and after, both reported; a moved pick is named.
- [ ] The four gates are green.
