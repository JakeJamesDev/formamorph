# 07: Manage Add-ons review

Status: ready-for-human
Base: aaa47db7
Status note: Built in `642e6b7e`, with one additive server field in `FormamorphServer` at `db0b7dd`.
Every acceptance criterion passes, verified end to end against the local server. Three review notes
are open for the author; see Comments.
Blocked by: 04
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: one dialog over a settled server contract, with staged state and list filtering; the rules are fully written in the spec.

## Parent

[spec.md](../spec.md) — World-author add-on review, Settled follow-up decisions (Relationships over time).

## What to build

A world author reviews the add-ons other authors offer for their published world.

**Manage Add-ons** sits on the published-world actions and opens a bounded dialog. Each add-on row shows its name, author, waiting time, and one three-way control ordered Approved, Unreviewed, Declined with Unreviewed centered; exactly one state is selected and reselecting it does nothing. A source update after a decision keeps the decision, adds an **Updated since review** badge, and puts the row back in the attention list. **Mark Reviewed** acknowledges the update without changing the decision. **Show** filters, with Needs Attention as the default, and **Sort** orders, oldest waiting first by default.

Decisions and acknowledgments are staged. Changed rows stay visible with a **Pending change** badge until **Save Changes** succeeds; **Discard Changes** drops them. Saved decisions change the world's download offerings: declined content leaves both add-on tabs and stays independently downloadable elsewhere. Approval leaves the add-on optional.

## Acceptance criteria

- [x] The dialog lists the world's associations with the three-way control, Unreviewed centered; Needs Attention shows unreviewed and updated rows only.
- [x] Choosing a state or Mark Reviewed shows Pending change and keeps the row visible under the current filter; Discard Changes restores the saved state.
- [x] Save Changes writes the decisions; a declined add-on disappears from the world's download offerings and an approved one moves to the Approved tab.
- [x] A source update on an approved add-on keeps Approved, shows Updated since review, and returns under Needs Attention; Mark Reviewed and Save clear it.
- [x] Desktop shows segments; below the mobile breakpoint the control becomes a select; footer order is Discard Changes then Save Changes.
- [x] Type check, lint, tests, and build pass.

## Blocked by

- 04 — Server: listing relationships and Unlisted.

## Comments

**Built in `642e6b7e`.** Gates, all run in the closing pass: `typecheck` 0 errors, `lint` 0 errors,
`test` 9755 passed across 593 files in 68.6 s, `build` succeeded in 17.5 s. The suite also reports 3
teardown errors from a leaked timer in `editorFieldFocus.ts`, raised by
`WorldEditor.dictionaryNavigation.test.tsx`. Those are present at Base `aaa47db7` too, so they are
not this unit's.

**The server gained one additive field.** `FormamorphServer` commit `db0b7dd` adds `offeredAt` to the
add-on and compatible-world payloads: the compatibility row's own `created_at`. The queue sorts by how
long a row has waited, and the component listing's own dates cannot supply that, because a republish
overwrites them without touching the offer. Existing readers ignore the field. **It needs a deploy
before the waiting times are exact in production.** Until then the client falls back to the listing's
`created_at`, which is the offer date for every offer made at first publication.

**Verified end to end against the local server**, signed in as the world's author: Needs Attention
listed the unreviewed offer alone; Everything listed the declined one the author alone may see; a
staged decline survived the switch back to Needs Attention; Save wrote the rows in the database. A
source given a new revision came back with **Updated since review** and its decision intact, and
**Mark Reviewed** plus Save set the reviewed revision to match. The world's own download review then
showed the approved add-on in the **Approved Add-ons** tab and nothing in **Community Add-ons**,
which is where the declined one left. The three-way control swaps to a select below the breakpoint
(measured in the DOM at 375 px wide).

### Three notes for the author

1. **Manage Add-ons has no visible label.** It is an icon on the author's own world card, named only
   in its tooltip and its accessible name. Every other author action on that card is an icon too, so
   it is consistent, but the words never render. Say if you want the name on screen instead.
2. **The footer stacks affirmative-first below `sm`.** This ticket asks for "Discard Changes then Save
   Changes"; the shared `DialogFooter` is `flex-col-reverse sm:flex-row`, which the Design System
   documents as correct ("Below `sm` ... puts the affirmative action above the negative action"), with
   negative-first DOM and keyboard order kept. The DOM order is what the test asserts. The shared
   pattern won; say if this dialog should differ.
3. **The row's second line names the kind**, as `Entity · quill · Waiting 12 days`. The ticket asks
   for name, author and waiting time. The kind is one word and tells an entity from a dictionary at a
   glance. Say if you want it out.
