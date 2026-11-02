# 01: Help Request Plan

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a prefactor of the help request, where every body must stay byte-equal.

## What to build

Make the Intents an easy change. `askHelp` decides today, inline, which blocks and functions ride a question: guide sections, world block, story so far, the code rider, script home line, code test and Quick Reference pin, docs lookup, roll, face, the player's Tools, and the riders. Pull that decision into one **Help Request Plan**: a value that says what this question's request carries. Today one plan comes from the settings, the Surface and `isCodeTurn`. The body is built from the plan alone.

No behavior changes. Every request body stays byte-equal to today's for the same question, settings and world.

Spec: Implementation Decisions, "Requests per Intent"; the fallback row.

## Acceptance criteria

- [x] One plan value holds every per-question choice listed above, and the body builder reads only the plan for them: `HelpRequestPlan` in `helpRequestPlan.ts`; each field flipped alone changes a body, and guide off with world on keeps the world block and story (parity test)
- [x] Today's plan comes from settings, the Surface and `isCodeTurn` in one place: `fullHelpPlan`
- [x] Bodies are byte-equal to before for a code turn, a non-code turn, the editor and game leans, lookup mode, the bare question, and Tools on: a parity test against bodies captured before the change: `helpSession.parity.test.ts` against `__bodies__/*.json`, committed at Base; a body log of all 123 help test files also showed all 1,062 Base bodies byte-equal after
- [x] The parity test fails when the plan drops one block: "changes some captured body when the plan sets …" per field; reverting `plan.story` and the guide/world split each turned it red

## Landed

**Not verified:** nothing.

**For you:** nothing to judge in play; the requests do not change.

**For ticket 02:**
- With `guide` off and `world` on, the message still opens with an empty `<guide>` block and grounds the answer in "guide and world sections". The World Intent's message text is prompt work for 02, with probe numbers.
- Plan riders join through `withCodeRider`, as the world rules already do. A neutral name such as `withRider` would read better.
