# 32: Docs block budget and cap

Status: ready-for-agent
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
