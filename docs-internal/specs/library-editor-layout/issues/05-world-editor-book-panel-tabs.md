# 05: World Editor Book Panel Tabs

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Library Editor Layout](../spec.md)

**What to build:** In the World Editor, the dictionary book panel has a Details tab and a Placeholders tab. The placeholder editor fills the panel height, as it does on the entity panel, and no longer sits in a fixed box under the form.

**Rationale for the model:** four sibling panels already have this exact tab pattern to copy. A mid-size model at medium effort.

## Acceptance criteria

- [ ] The book panel renders its tabs from a tab list in the same form as the other panel tab lists, through the shared panel tab strip.
- [ ] Details holds Name, Description, Enabled, and the entry count hint. Placeholders holds the scoped placeholder editor in its fill form.
- [ ] Placeholders is Advanced only. In Simple mode the panel shows Details with no strip.
- [ ] The World Editor keeps the chosen book tab while the author selects another book.
- [ ] The dev router reaches both book panel tabs in one call, and the drift guard covers the new ledger entry.
- [ ] The UI is checked through the dev router with static frames at the panel widths where the editor pane is narrow.
- [ ] All four gates pass, and `graphify update .` has run.
