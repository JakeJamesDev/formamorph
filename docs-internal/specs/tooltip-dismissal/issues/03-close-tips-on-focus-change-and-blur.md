# 03: Close Tips on Focus Change and Blur

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: three more triggers on the same hook; the focus rule must not break keyboard tips.

Parent: [Tooltip Dismissal spec](../spec.md)

## What to build

A tip closes when focus moves outside its trigger, so a menu or dialog that opens from a shortcut or from the control is never covered by a stale tip (Q2). A tip also closes on window blur and when the tab is hidden. Tabbing to another tipped control still opens that control's tip.

## Acceptance criteria

- [ ] `focusin` outside the open trigger closes the tip.
- [ ] Focus that moves to another tipped control opens that control's tip.
- [ ] Window `blur` closes an open tip.
- [ ] `visibilitychange` to hidden closes an open tip.
- [ ] The wrapped `Tooltip` root follows the same rules.
- [ ] Tests at the tooltip seam. Each fails when its listener is removed.
