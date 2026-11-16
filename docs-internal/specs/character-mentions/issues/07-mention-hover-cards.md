# 07: Mention Hover Cards

Status: done
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A resolved mention in narration links to its entity and opens a small card.

- **Links:** mention links go through the renderer's remark-plugin and component props, as stable references. They stay subtle, so narration still reads as prose.
- **Opening:** hover opens the card on desktop, and tap opens it on touch devices.
- **Content:** the card reads from the Player View only.
  - Met entities show under their true name.
  - Unmet strangers show under the label the player saw.
  - No hidden or AI-only content appears.
- **Prototype:** follow variant A on `prototype/character-mentions` (spec, Further Notes).
  - Mentions stay plain text and show a dotted underline in the character's color on hover.
  - On a fine pointer, the card opens after about 300 ms of hover; click or tap opens it everywhere.
  - The card shows an initial, the name and a one-line description, with "Wrong character?" under them.
  - Clicking a quote opens its speaker's card.
- **Design approval:** a hover card is a new visual pattern. Build it as a design-system entry with a dev-router showcase, and get the user's approval before it ships.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [x] Resolved mentions render as links, and unresolved text is unchanged. `MentionCards.test.tsx` "turns resolved mentions into triggers…" and "renders unchanged with no reading" (innerHTML equal).
- [x] The card for an unmet stranger never shows its true name or hidden content. The test runs through the Player View. "shows an unmet stranger under the label the player saw…", rows from `buildPlayerView`.
- [x] Tapping opens the card on touch devices, and keyboard focus opens it too. Tests for tap, focus, Enter and touch pass-over; tap checked in the game at 375 px.
- [x] Frames: `.scratch/frames/mention-card-light.png`, `mention-card-dark.png` and `mention-card-mobile.png`. Light and dark from the showcase, mobile from the `speakerQuotes` fixture.

For you: approve the card design.

## Landed

**Not verified**
- Nothing unticked.

**For you**
- Approve the card design: [mention-card-light.png](../../../../.scratch/character-mentions-07/frames/mention-card-light.png), [mention-card-dark.png](../../../../.scratch/character-mentions-07/frames/mention-card-dark.png), [mention-card-mobile.png](../../../../.scratch/character-mentions-07/frames/mention-card-mobile.png), live at `#dev?modal=designSystem&tab=mention-cards`. The description clamps at two lines, not one.
- Copy: "Wrong character?" conflicts with the Writing Guide (never "character" for an entity). It renders only once ticket 08 wires it (Q47); rule on the label before 08.
- Hover feel: 300 ms open and 200 ms close delays, at `#dev?view=gameViewer&fixture=speakerQuotes` with Character Mentions on.

**For ticket 08**
- The card opens on focus but Tab moves on to the next mention, which closes it. Once "Wrong character?" exists, keyboard users need a way into the card.
