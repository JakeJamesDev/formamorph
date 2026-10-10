# 04: Copied Bubble Follows Tip Rules

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: a controlled component needs a dismissed flag that resets on the next open.

Parent: [Tooltip Dismissal spec](../spec.md)

## What to build

The **Copied** bubble on a help code block (FlashTip) uses the module's dismissal hook, so it closes on the same triggers as every tip (Q4). Its owner still passes `open`. A dismissed bubble stays closed until its owner opens it again, so the next copy shows it.

## Acceptance criteria

- [ ] FlashTip closes on scroll while its owner still passes `open`.
- [ ] FlashTip shows again when `open` goes from false to true.
- [ ] A change in the owner's `cycle` count clears the dismissed flag, so a second copy inside the window shows the bubble (Q9).
- [ ] FlashTip picks up every trigger the shared hook has, with no list of its own.
- [ ] The existing CodeSnippet tests stay green.
- [ ] Tests at the tooltip seam. Each fails when its guard is removed.
