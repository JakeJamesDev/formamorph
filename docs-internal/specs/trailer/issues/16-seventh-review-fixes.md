# 16: Seventh Review Fixes

Status: ready-for-human
Blocked by: 15
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the stack from ticket 15 is reused in three places and the tall cut's turn recapture must take a card on top of it; the rest is reordering and one copy line.

Parent: [Trailer spec](../spec.md)

## What to build

The user's seventh review. Each item is a ruling.

- **Two play stacks (Q67).** The four play shots become two two-card stacks under the stack rules (Q61, Q62). Stack one: the turn card (W05, the reveal clip with its typed panel) lands first, then the stats clip (W06) lands on it. Stack two: the entity card (W07) lands first, then the chat shot (W08) lands on it. A section join parts the two stacks. In the tall cut, T05 and T06 become the same two column stacks: the turn recapture then the stats clip; the entity card then the chat column. The old T06 pairing of stats with the entity card goes away. If the typed panel under the turn card leaves no room for the stats card in the tall column, ask the spec session before changing the typed panel.
- **Traits join the build stack (Q68).** The Blueprint card (W12) becomes the fourth card of the build stack: map, profile, travel, traits, inventory. Inventory stays last. The traits title card (W12a, T10a) is cut. The tall column takes the same five cards.
- **Community title card (Q69).** A kinetic card "Join the community." sits before the world grid shot (W14) in the wide cut and before T11 in the tall cut, where the traits title card used to sit in the arc.
- Re-render both cuts. Update storyboard §1, §2 and §4, including the at-a-glance table and the totals, and Q9's length note in the spec. Look at every stack landing on a contact sheet.

## Acceptance criteria

- [x] The wide cut shows the turn card with the stats clip landing on it, then the entity card with the chat shot landing on it, with a section join between the two stacks. Seen on `wide-stack-W05.png`, `wide-stack-W07.png`, `wide-turn-stats.png`; W05 and W07 out `section` in `timeline.tsx`.
- [x] The tall cut shows the same two column stacks in place of T05 and T06. Seen on `tall-stack-T05.png`, `tall-stack-T06.png`, `tall-turn-stats.png`.
- [x] The build stack has five cards in this order: map, profile, travel, traits, inventory; no traits title card remains in either cut. Seen on `wide-stack-W10.png`, `tall-stack-T09.png`; W10/1 to W10/5 in the render report.
- [x] "Join the community." is a title card before the world grid in both cuts. `wide-community-title.png`, `tall-community-title.png`; W14a and T11a in the render report.
- [x] Every stack card holds at least 2 s and its reading time; the subject check follows the newest card; both 6 s loops pass; the Steam checks pass; storyboard totals match the renders. Render exit lines all OK, no FAIL: wide 82.67 s, 11,946 Kbps; tall 67.07 s. A section join first printed FAIL on the last card of each stack, which the fix cleared.

## Landed

**The typed panel is unchanged.** The tall stats card covers it after it dims, which Q62 allows, so no spec-session question was needed. The panel dims with the turn card.

**Not verified:**

- Nothing left unticked. A contact sheet shows clips on their first frame, so the reveal was checked on stills of the real composition: `.scratch/trailer-16/frames/wide-turn-reveal.png`, `.scratch/trailer-16/frames/tall-turn-reveal.png`.

**For you:**

- Watch the stacks in `TrailerWide.mp4` at 10.40 s, 18.85 s and 27.58 s, and in `TrailerTall.mp4` at the same times. Both cuts are in `.scratch/trailer-16/frames/`.
- At each stack's exit, the cards fade together, so the dimmed panel text shows through the stats card for about 0.5 s. Check that it does not read as a mix.
- The stats callout ring ends on the Charge bar. It is the old W06 region, and the tall cut now shows it too. Decide if it should grow to take in the bar.
- The changelog's unreleased Trailer entry still says "four cards" and "65 s". A ticket fragment cannot edit it. It needs a fold at release.
