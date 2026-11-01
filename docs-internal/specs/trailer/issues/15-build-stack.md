# 15: Build Stack

Status: ready-for-agent
Blocked by: 14
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a new compositing pattern that must pass the reading, subject and loop checks, plus two new captures picked by eye.

Parent: [Trailer spec](../spec.md)

## What to build

The user's seventh review. The authoring section shows each feature building on the last.

- **The stack (Q61).** After the "Build your own world." title card (W09), four cards land in turn, each offset on the one before: the map, the entity profile, the travel dialog, then the inventory card. Cards that have had their hold dim to depth cards and stay in frame. The newest card carries the caption pill. Each card holds 2 s or its caption's reading time, whichever is longer; the reading check (Q17, Q25) is unchanged. The traits title card (W12a) and the Blueprint card (W12) follow the stack as today. The stack replaces W10, W11 and W10b.
- **Tall cut (Q61).** The stack is a column. It replaces T09 and T10. Keep T10a and T10b after it.
- **Checks (Q62).** The subject check runs on the newest card only; a card past its hold is a depth card and may be covered. The dense-card hold does not apply while the stack grows. Change the checks in `marketing/trailer/scripts/render.mjs` so they know a stack, and keep every other shot on the old rules.
- **Map with its background (Q63).** Recapture C05 with Veilwood's authored layout and its Map Background behind the locations. Do not run Auto Arrange All. Keep the travel-rule labels hidden as the capture does today.
- **Profile and travel captures (Q64).** Pick by what looks best on the card, not by world. The user named the Brinewell entity's image as a candidate for the profile card. Put the candidates on one contact sheet and pick; if two read equally well, ask the spec session.
- **Inventory capture (Q64).** New. Capture the game's Inventory tab (`gameViewer`, tab `inventory`, `fixture=items`) and the editor's Items tab (`modal=worldEditor`, tab `items`, `fixture=items`). Put both on the contact sheet at the card's crop and pick the one that reads better. Give it a subject region like every other capture.
- **Copy (Q65).** Inventory caption: "Give them items to carry, wear and use." If the user sends another line before you reach it, use that.
- Re-render both cuts. Update storyboard §2, §4 and §5, including the at-a-glance table and the totals. Look at the stack frame by frame on a contact sheet through every landing.

## Acceptance criteria

- [ ] The wide cut shows the four-card stack after W09, each card landing on the last, earlier cards dimmed, the newest with its caption.
- [ ] The tall cut shows the same stack as a column between T08 and T10a.
- [ ] Every stack card holds at least 2 s, and at least its caption's reading time.
- [ ] The subject check passes on the newest card of the stack and still runs unchanged on every other shot; the dense-card check skips the growing stack.
- [ ] The map card shows Veilwood's Map Background under its authored locations.
- [ ] The inventory capture is in `captures.json` with a subject region, and the contact sheet shows both candidates.
- [ ] Both 6 s loops pass; the Steam checks pass; storyboard totals match the renders.
