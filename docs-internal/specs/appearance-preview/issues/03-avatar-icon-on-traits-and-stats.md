# 03: Avatar Icon on Traits and Stats

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

One pure function and three places that show it. The care is in "only when an Avatar is in use", which differs per place.

## What to build

A player sees which traits and stats change the Avatar, and what they change (spec, Avatar icon; Q11, Q12, Q17).

- One pure function reads a trait's or stat's slider and color rows and returns the names of what it changes: cleaned slider names in row order, then Skin Color, Eye Color and Hair Color.
- A trait or stat with at least one such row shows the Avatar element icon. A Body pick alone shows none.
- The hover text opens with one line that says it changes the Avatar's appearance, then the names. Past four names, the rest is a count. It never gives a value. Read the Writing Guide before you write it.
- The icon shows on traits in new-game trait selection, on the Traits tab in play, and on stats in the Stats tab in play.
- It shows only when the owner's Avatar is in use: the played persona's for the player's traits and stats, the entity's own for an entity's. With no Avatar there is no icon.
- The World Editor's lists do not show it.
- Update the wiki pages on traits and stats in play.

## Acceptance criteria

- [ ] A trait with a slider pin shows the icon in new-game trait selection when the persona has an Avatar.
- [ ] The same trait shows no icon when the persona has no Avatar.
- [ ] The Traits tab in play shows the icon on a trait with a color pin, and none on a trait with only a Body pick.
- [ ] The Stats tab in play shows the icon on a stat with a slider or color row.
- [ ] An entity's own trait shows the icon only when that entity shows an Avatar.
- [ ] The hover text names each change and holds no number and no color code.
- [ ] Six changes give four names and "2 more", in the Writing Guide's wording.
- [ ] Table tests cover the function: sliders only, colors only, both, more than four, a Body pick only, no rows.
- [ ] Mutation: drop the Avatar-in-use check, and the no-Avatar test fails.
- [ ] Frames: `.scratch/frames/trait-select-avatar-icon-dark-1440.png` and `.scratch/frames/traits-tab-avatar-icon-dark-1440.png`, each with the hover text open.

For you: read the hover text in trait selection and judge whether the icon reads as "changes my Avatar".
