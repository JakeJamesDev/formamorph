# 32: Docs block budget and cap

Status: done
Base: 2b387d53
Blocked by: 26
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A "here" question gets every section the budget allows, never more than the cap (Q54), and the screen's how-to sections when it asks how (Q60). The effort review found two faults in how the help session fills the docs block.

- **Double count.** The help session takes the surface section's length off the budget, then searches. When the search also finds that section, its length counts a second time before the duplicate is dropped. The other hits get less room than the budget allows.
- **Cap.** The 5-section limit covers only the search hits, so the surface section makes a sixth.

The fix:

- The budget and the cap cover the whole docs block, the surface section included.
- The surface section counts once, whether or not the search finds it too.
- The surface section still goes first.
- **"Here" task questions (Q60).** "How do I add one here?" failed on 5 of 6 surfaces in ticket 26: the surface maps to the page intro, and the question has no keyword, so no how-to section is sent. When the question has a surface, also search within the surface's page, so its how-to sections can reach the block under the same budget and cap.
- Drop the `?? id` fallback in the surface label lookup. The coverage test already fails for an unlabeled id, so the fallback is dead code that ticket 29 asked to remove.

**Probe.** This changes which sections reach the model, so rerun ticket 26's "here" cases on the default cloud model, same harness (`npm run probe:help -- --kinds here`), with an in-batch control on the old build. Report sections sent and grounded-correct rate per arm.

Recommended model rationale: a small selection fix with a focused probe.

## Acceptance criteria

- [ ] When the top search hit is the surface section, the block counts it once; a test asserts the other hits fill the full budget
- [ ] A request never holds more than 5 sections, surface section included; a test asserts it
- [ ] The surface section stays first in the block
- [ ] A "how do I add one here?" question on World Editor → Locations sends the Locations how-to section; a test asserts it
- [ ] The surface label lookup has no raw-id fallback
- [ ] Probe numbers for the "here" cases, fixed vs old build, same batch, are in the handover
- [ ] Four gates green

## Handover

Built in 809171e3 (amended with the review fold-in). Gates green: typecheck, lint, 965 test files, build.

- `helpSections` takes the surface section as `lead`: it goes first and counts once toward the 12,000-character budget and the 5-section limit. The open page's best two "How to" sections join after the question's top hit.
- Page hits are limited to "How to" headings: on the real Locations page the long "The panel" and "Connections" sections outrank the how-to for "add one here".
- `surfaceLabel` has no raw-id fallback. The cast leans on the coverage test in `surfaceLabels.test.ts`.
- `npm run probe:help -- --kinds here --old --runs 6`: new `--old` arm keeps the surface section outside the block. Cloud default model, same batch, 12 questions × 6 runs.

| Arm | Grounded-correct | Right section sent | Wrong step |
|---|---|---|---|
| Fixed | 88% | 100% | 0% |
| Old block | 51% | 58% | 8% |
| No docs | n/a | n/a | 0% |

- Not addressed: `--old` copies the old selection by hand, so it will not follow later changes to `askHelp`.
