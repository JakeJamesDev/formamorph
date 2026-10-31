# 02: In-Use Delete Standard

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

This is a small helper and a docs section. Its pattern is already in the code.

## What to build

The Design System states the in-use delete standard:
- A record nothing uses deletes at once.
- A record with hard references (picks, links, slot references) opens a `ConfirmDialog` with a count or the names, then clears them.
- Soft references (requirement rows, scripts, text chips) stay. They turn red, and the Test Bench reports them.

One shared helper builds the "used by" confirm text from a list of counted reference kinds. `alsoDeletesLinks` folds into it, so the stat and trait link confirms use the helper with the same behavior. Ticket 03 makes Body and slot deletes its first new users. The other delete flows stay as they are (Q30).

Spec: Implementation Decisions under Delete standard; Q25, Q29, Q30.

## Acceptance criteria

- [x] `docs/Design-System.md` has an in-use delete section with the three cases (section "Standard: In-Use Delete")
- [x] One helper turns counted reference kinds into the confirm text, and a delete with zero uses needs no confirm (`usedByText` returns `null`)
- [x] Stat, stat group and trait deletes with links show the same confirm as before, now built by the helper (`TraitTree.links.test.tsx` and `WorldEditor.statBlueprints.test.tsx` pass unchanged)
- [x] The helper has unit tests for one kind, several kinds and zero uses (`usedByText.test.ts`; the zero-use case fails when the helper returns `""`)

## Landed

**Not verified**
- None.

**For you**
- Read the "Standard: In-Use Delete" section in `docs/Design-System.md` and say whether the three cases match what you want.
