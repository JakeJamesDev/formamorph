# 16: Seventh Review Fixes

Status: ready-for-agent
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

- [ ] The wide cut shows the turn card with the stats clip landing on it, then the entity card with the chat shot landing on it, with a section join between the two stacks.
- [ ] The tall cut shows the same two column stacks in place of T05 and T06.
- [ ] The build stack has five cards in this order: map, profile, travel, traits, inventory; no traits title card remains in either cut.
- [ ] "Join the community." is a title card before the world grid in both cuts.
- [ ] Every stack card holds at least 2 s and its reading time; the subject check follows the newest card; both 6 s loops pass; the Steam checks pass; storyboard totals match the renders.
