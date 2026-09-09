# 07: Manage Add-ons review

Status: ready-for-agent
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

- [ ] The dialog lists the world's associations with the three-way control, Unreviewed centered; Needs Attention shows unreviewed and updated rows only.
- [ ] Choosing a state or Mark Reviewed shows Pending change and keeps the row visible under the current filter; Discard Changes restores the saved state.
- [ ] Save Changes writes the decisions; a declined add-on disappears from the world's download offerings and an approved one moves to the Approved tab.
- [ ] A source update on an approved add-on keeps Approved, shows Updated since review, and returns under Needs Attention; Mark Reviewed and Save clear it.
- [ ] Desktop shows segments; below the mobile breakpoint the control becomes a select; footer order is Discard Changes then Save Changes.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 04 — Server: listing relationships and Unlisted.
