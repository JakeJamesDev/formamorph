# 03: Avatar Icon on Traits and Stats

Status: done
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

- [x] A trait with a slider pin shows the icon in new-game trait selection when the persona has an Avatar. (`AvatarChangeIcon.test.tsx`, "shows the icon on a slider pin…", through `SetupTraitList`)
- [x] The same trait shows no icon when the persona has no Avatar. (same file, "shows no icon when the persona has no Avatar")
- [x] The Traits tab in play shows the icon on a trait with a color pin, and none on a trait with only a Body pick. (test "shows the icon on a color pin and none on a Body pick"; DOM read on the `avatarIcon` fixture: Elf and Pale have it, Plain has none)
- [x] The Stats tab in play shows the icon on a stat with a slider or color row. (`StatRow` tests, slider and color cases)
- [x] An entity's own trait shows the icon only when that entity shows an Avatar. (the `avatarInUse(ownerId)` prop is asked once per owner; "asks about the trait's own owner" test)
- [x] The hover text names each change and holds no number and no color code. (`avatarChanges.test.ts`, "holds no number and no color code…")
- [x] Six changes give four names and "2 more", in the Writing Guide's wording. (test "gives four names and a count for six changes"; the guide has no list rule, so the tip uses `Intl.ListFormat`)
- [x] Table tests cover the function: sliders only, colors only, both, more than four, a Body pick only, no rows. (`avatarChanges.test.ts`)
- [x] Mutation: drop the Avatar-in-use check, and the no-Avatar test fails. (ran it: four tests went red, then restored)
- [ ] Frames: `.scratch/frames/trait-select-avatar-icon-dark-1440.png` and `.scratch/frames/traits-tab-avatar-icon-dark-1440.png`, each with the hover text open. (the Traits tab frame is stored; the trait-selection frame is not)

## Landed

**Not verified**
- Trait-selection frame: Enter World opens only for a stored world, and no stored world holds an Avatar pin. The component tests cover the surface. The setup predicate `ownerAvatarInUse` in `EnterWorldFlow.tsx` has no test.
- Stats tab frame and an entity's own Avatar rows in the live panel: only the component tests cover them.
- The Traits tab frame file is a JPEG saved under a `.png` name.

**For you**
- Read the hover text in trait selection and judge whether the icon reads as "changes my Avatar".
- Dev route `#dev?view=gameViewer&tab=traits&fixture=avatarIcon` (open the Global section and **Disabled**): hover the Elf icon.
- Frame: `.scratch/appearance-preview-03/frames/traits-tab-avatar-icon-dark-1440.png`
