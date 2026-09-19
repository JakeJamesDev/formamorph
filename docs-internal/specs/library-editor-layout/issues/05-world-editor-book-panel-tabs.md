# 05: World Editor Book Panel Tabs

Status: ready-for-human
Status note: Built in "Add Book Panel Tabs" and "Open The Book Details Tab For A Find Hit". Details renders ticket 04's `DictionaryBookFields`. Review found that Find could not reach a book's Name or Description while Placeholders was open; the follow-up fixes that. Like the entry panel, the dev route needs a book selected first.
Base: 6d200263
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Library Editor Layout](../spec.md)

**What to build:** In the World Editor, the dictionary book panel has a Details tab and a Placeholders tab. The placeholder editor fills the panel height, as it does on the entity panel, and no longer sits in a fixed box under the form.

**Rationale for the model:** four sibling panels already have this exact tab pattern to copy. A mid-size model at medium effort.

## Acceptance criteria

- [x] The book panel renders its tabs from a tab list in the same form as the other panel tab lists, through the shared panel tab strip.
- [x] Details holds Name, Description, Enabled, and the entry count hint. Placeholders holds the scoped placeholder editor in its fill form.
- [x] Placeholders is Advanced only. In Simple mode the panel shows Details with no strip.
- [x] The World Editor keeps the chosen book tab while the author selects another book.
- [x] The dev router reaches both book panel tabs in one call, and the drift guard covers the new ledger entry.
- [x] The UI is checked through the dev router with static frames at the panel widths where the editor pane is narrow.
- [x] All four gates pass, and `graphify update .` has run.
