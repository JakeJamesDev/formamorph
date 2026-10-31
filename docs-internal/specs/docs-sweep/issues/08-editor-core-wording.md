# 08: Editor Core Wording

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a rewrite under fixed rules, with the facts already settled by ticket 07.

## What to build

Rewrite these pages under the Writing Guide: [WorldEditor](../../../../docs/WorldEditor.md), [World-Editor-Overview](../../../../docs/World-Editor-Overview.md), [World-Editor-Locations](../../../../docs/World-Editor-Locations.md), [World-Editor-Entities](../../../../docs/World-Editor-Entities.md), [World-Editor-Openings](../../../../docs/World-Editor-Openings.md), [World-Editor-Media](../../../../docs/World-Editor-Media.md).

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Spec: Implementation Decisions, "Wording pass", "Headings and anchors".

## Acceptance criteria

- [ ] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here
- [ ] Control names take the exact casing of the on-screen label
- [ ] Product terms match "Controlled product terms"
- [ ] Paragraphs are short and steps are scannable lists
- [ ] No fact changed: a diff read finds no new claim, limit or default
- [ ] A renamed heading updates every anchor table that names it; the docs tests are green
