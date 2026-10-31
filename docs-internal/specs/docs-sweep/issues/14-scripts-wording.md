# 14: Scripts Wording

Status: ready-for-agent
Blocked by: 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a rewrite under fixed rules, with the facts already settled by ticket 13.

## What to build

Rewrite these pages under the Writing Guide: [ScriptsGuide](../../../../docs/ScriptsGuide.md), [StatCodeGuide](../../../../docs/StatCodeGuide.md).

Read "Before you write", "Labels, capitalization, and complete sentences" and "Controlled product terms" and "The technical register" first. Run `npm run copy:sweep` on the pages and triage each notice under the copy-sweep skill. Write the rewrite yourself. Change no facts: a fact that looks wrong goes to the spec session.

Spec: Implementation Decisions, "Wording pass", "Headings and anchors".

## Acceptance criteria

- [ ] Every copy-sweep notice on the pages is fixed or triaged as a false positive; the count before and after is recorded here
- [ ] Control names take the exact casing of the on-screen label
- [ ] Product terms match "Controlled product terms"
- [ ] Both guides got the hand sweep the copy-sweep skill requires: the script skips `docs/*Guide.md`
- [ ] Paragraphs are short and steps are scannable lists
- [ ] No fact changed: a diff read finds no new claim, limit or default
- [ ] A renamed heading updates every anchor table that names it; the docs tests are green
