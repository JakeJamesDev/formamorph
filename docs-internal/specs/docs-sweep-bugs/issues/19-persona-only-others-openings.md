# 19: Mark a Persona-Only Entity's Others Openings

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: extends the rule ticket 11 built to a second entity kind, whose rows draw once a player picks it.

## What to build

An unpicked Persona-Only entity's Others openings never draw, but the world panel shows a draw chance and no mark. Ruling Q15: they get what ticket 11 gave the Custom Persona. Each such row shows **Never Draws** and a dash, and leaves the view's pool, so it stops diluting other rows' chances. Check first how a pick changes this: if the entity is played, its Others rows may still never draw, and the mark must be true in every case it shows.

This ticket owns the "can this row draw" rule. Ticket 20 reads it.

Spec: Q15. Evidence: ticket 11, Landed.

## Acceptance criteria

- [x] An Openings panel test with an Others row on a Persona-Only entity fails today (no mark), then passes: "marks an Others row with a dash for its chance", red then green; 12 mutations each failed a test; DOM read in the preview, dash and mark
- [x] The world openings view shows no chance for those rows and other rows' chances no longer count them (pure test): "takes those rows out of the pool, so they dilute no other row"; preview read 33% on each of three rows that draw
- [x] Rows on Playable and Cast entities are unchanged (test): "leaves Playable and Cast rows in the pool, each with its chance and no mark"
- [x] World-Editor-Openings describes the mark; the docs tests are green: `src/lib/docs` tests green with the opening suites, 9 files
- [x] A changelog fragment under Minor / Fixed / 👤: `docs-internal/changelog.d/docs-sweep-bugs-19.md`

## Landed

Pick check: a Persona-Only entity's Others rows never draw, picked or not. Picked, it is the player; unpicked, it is absent. The mark has no pick condition. Spec-session rulings for this ticket: the rule is wider than Q15's "unpicked", ticket 11's four rulings carry over, and the own-tab hint is in scope. `othersNeverDraw` in `src/lib/openings.ts` is the rule ticket 20 reads.

**Not verified:**

- Nothing left unticked. The tip was read in jsdom, not in the live editor.

**For you:**

- Look at the mark on a Persona-Only Others opening in the World Editor. Frame: `.scratch/docs-sweep-bugs-19/frames/persona-only-never-draws.jpg`.
- Until ticket 20 lands, the Openings checkbox and footer hint still count these rows, so they can say an opening draws while the panel shows the default opening. Ticket 20's text names only Custom Persona rows; `hasAuthoredOpenings` covers both.
