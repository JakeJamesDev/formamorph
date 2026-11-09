# Spec: Avatar Look Bindings

Status: ready-for-agent
Spec session: avatar-look-bindings — spec

## Problem Statement

An author can make a stat grow a body slider, and nothing else. A trait can't change the Avatar at all, so a Human or Elf trait can't give the right ears, and a Cat Ears trait can't show cat ears. No stat or trait can change skin, eye or hair color.

The stat picker also lists body sliders only, and each slider can belong to one stat only. Head Features such as Ear Shape, Cat Ears or Fox Tail can't be bound to anything.

Players expect stats to keep moving body sliders exactly as they do today: added on top of their own shape, and growing past the max. Any change must keep that.

## Solution

Stats and traits can both drive Avatar sliders and colors, on the player's Avatar and on entity Avatars.

- **A stat changes a slider by an amount.** The amount is added on top of the player's value, scaled by how far the stat is through its range. The default amount is 1, which is today's behavior.
- **A stat blends a color.** It moves from the player's color toward a target color as the stat rises.
- **A trait sets a slider or a color while it is active.** When it goes inactive, the player's own value returns.
- Stats add on top of what an active trait set.
- When two active traits set the same control, the trait switched on most recently wins, as with trait Body rows.
- Character Customization shows a control that a checked trait holds as locked, with a note naming the trait.
- The pickers list body sliders and Head Features, and several stats can share one slider.

## User Stories

1. As a world author, I want to bind a stat to a body slider with a Change By amount, so that the stat grows or shrinks that part by the amount I choose.
2. As a world author, I want Change By to default to 1, so that a new binding behaves like the bindings I already have.
3. As a world author, I want a negative Change By, so that a stat such as Hunger can make a slider shrink.
4. As a world author, I want to bind one stat to several sliders, each with its own Change By, so that one stat shapes several parts at different rates.
5. As a world author, I want to bind a stat to a Head Features slider, so that a stat such as Corruption can grow Ear Shape or Tusks.
6. As a world author, I want the slider picker to split each model's sliders into Body Sliders and Head Features, so that I can find them as they appear in Customization.
7. As a world author, I want to bind a stat to the skin, eye or hair color with a target color, so that the color shifts as the stat rises.
8. As a world author, I want the color to blend smoothly without muddy midpoints, so that halfway looks like a real color between the two.
9. As a world author, I want the color to stop at the target past the stat's max, so that it never overshoots into a color I didn't pick.
10. As a world author, I want two stats on the same color to apply in a fixed order, so that the result is predictable.
11. As a world author, I want two stats to share one slider and add their amounts, so that Hunger and Weight both grow Thickness.
12. As a world author, I want to give a trait rows that set a slider to a value, so that a Human trait holds Ear Shape at 0 and an Elf trait holds it at 1.
13. As a world author, I want a trait's Set To value to accept any number, so that I can push a slider past what a player could pick by hand.
14. As a world author, I want to give a trait rows that set the skin, eye or hair color, so that a Drow trait sets the skin color.
15. As a world author, I want a trait with no "off" value to leave the slider alone when inactive, so that I don't have to fight the player's choice or other traits.
16. As a world author, I want stats to add on top of a trait's value, so that a Thick trait sets Thickness and a Weight stat still grows it.
17. As a world author, I want the trait switched on most recently to win when two active traits set the same control, so that it matches how trait Body rows behave.
18. As a world author, I want the editor to warn me when two traits that can be active together set the same control, so that I know an overlap can happen in play.
19. As a world author, I want no warning for traits in a pick-one group, so that Human and Elf don't nag me.
20. As a world author, I want a binding to a slider or color the current model lacks to be marked "not on this model", so that I know why it has no effect.
21. As a world author, I want a binding the model lacks to do nothing in play, so that my world stays portable across Avatars.
22. As a world author, I want a binding on Thickness to work on a model that names it Fat or Weight, so that aliases keep working as they do today.
23. As a world author, I want entity stats and traits to drive that entity's own Avatar, so that an entity's corruption shows on its own model.
24. As a world author, I want an entity with a non-VRM model to keep its stat sliders, and to skip colors, so that nothing breaks on that lane.
25. As a world author, I want a linked trait to carry its slider and color rows unchanged, so that a linked Elf is always an Elf.
26. As a world author, I want a stat-link override to carry Change By and color bindings, so that a linked stat can bind differently, as it can today.
27. As a world author, I want my existing worlds, entities, stat links and library records to load with every binding unchanged in effect, so that nothing I shipped looks different.
28. As a world author, I want a binding I change in the world to reach saves in progress, so that I can tune the look without a new game.
29. As a player, I want stats to keep adding to my own body shape, so that my customization still matters as stats change.
30. As a player, I want a stat above its max to keep growing the body, so that the game behaves as it always has.
31. As a player, I want a raised max during play not to shrink my body at the same stat value, so that the shape stays stable.
32. As a player, I want a trait that ends to give my own slider value and color back, so that my choice returns.
33. As a player, I want a control that a trait I checked holds to show as locked in Character Customization, with the trait's name, so that I know why it won't move.
34. As a player, I want a trait switched on during play, by me or by an item, to change the Avatar at once, so that the change matches the story.
35. As a player, I want a color a stat blends to start from the color I picked, or the model's own colors when I picked none, so that the change begins from how my character looks.
36. As a player, I want a skin color on a model with separate face and body materials to blend each part from its own color, so that the face and body don't flatten into one tone.
37. As a player, I want a save I load to show the trait looks at once, so that I don't wait for the next trait change.
38. As a player, I want paging back through history to show the look of that turn, so that the Avatar matches the turn on screen.
39. As a player with an older save, I want it to load and show the look from the traits active now, so that it works without a fresh start.

## Implementation Decisions

**The math (Q1, Q3, Q9, Q10).** For each slider:

- Start from the player's value (the customization value, or 0 when the player set none).
- If an active trait sets it, replace that value with the trait's Set To (Q3).
- Add every bound stat's `t × by`, summed (Q1, Q9). `t` is the stat's normalized value, as `normalizeStat` computes it today: anchored to the authored max, floor-clamped at 0, unbounded above, and capped at 1 for percentage stats.
- A stat that is off adds nothing, both from its saved `enabled` flag and from a trait's stat toggle. Entities follow the same rule as the player.

For each color (Q5, Q10):

- Start from the player's color, or the model's own colors when the player picked none.
- If an active trait sets it, replace it (Q3).
- Apply each bound stat in authored order (group, then `order`, as the editor tree shows it): blend in OKLab toward the stat's target, by `t` clamped to [0, 1].

**One resolver.** A pure module next to the existing stat-morph helpers. Inputs:

- the customization;
- the model's key catalog (body and head keys), so the resolver skips keys the model lacks and resolves aliases (Fat, Thickness, Weight) to the model's own name before it merges;
- the active traits in switch-on order;
- the active stats with their authored twins.

Outputs:

- the final morph map, in the model's own key names;
- for each color channel, either "none" (the model keeps its own colors) or a set color plus a list of `(target, t)` blend steps;
- for each control, the trait that holds it, if any.

It replaces the summing in `mergeBodyMorphs` and the per-stat map in `statMorphMap`. The game's player Avatar, entity Avatars and Character Customization's lock all read it.

**Colors in the viewer (Q5).** The model's own colors exist only inside VRMViewer, after load, one median per material. So the viewer applies the color plan itself, per material:

- A channel with "none" resets to the model's own colors.
- The start color is the player's pick, or that material's own median when the player picked none.
- The viewer runs the blend steps from that start.

This keeps separate materials in one channel (face and body skin, two eyes) apart.

**A material's own color (Q21).** The plain texture median fails on atlases where other parts outnumber the skin (Aki's body atlas holds black tights). Ticket 06 finds each material's color from its dominant color cluster instead. That fixes the bindings and the player's own Skin Color picker. Ticket 04 lands as specced first.

**Trait precedence (Q4, reopened).** Among active traits that set the same control, the most recently switched-on wins. Traits switched on together fall back to tree order. This reuses the switch-on order the inventory settle already keeps for Body rows (`BodyRuntime.traitsOn`). That list widens to also hold traits that carry slider or color rows. `traitBodyPicks` already skips entries with no Body pick, so Body resolution doesn't change. As with Body rows, the played entity's own traits drive the played Persona.

**Reading the order.** Load runs no settle, so the resolver itself treats an active trait missing from `traitsOn` as switched on after every listed one, in tree order. An older save and a fresh load then show trait looks at once. History paging reads the viewed snapshot's `bodies`, as it reads `viewTraits`.

**Schema: stat bindings.** `morphBindings` changes from a list of names to a list of `{ name, by? }`. Absent `by` means 1. A `by` of 1, or an empty field, is stored absent, so an untouched binding round-trips as `{ name }`. Any finite number is allowed, with no clamp. When one stat's bindings resolve to the same model key through aliases, that key counts once for the stat, with the first binding's `by`. A new optional `colorBindings` holds `{ channel, color }`, where `channel` is `skin`, `eye` or `hair`. A stat-link override (`StatLinkFields`) carries both fields in the same forms.

**Schema: trait rows.** A trait gains optional `morphPins` (`{ name, value }`) and `colorPins` (`{ channel, color }`). Set To takes any number (Q13). Trait links carry no override for them (Q20).

**Migration.** One always-run step turns each `morphBindings` string into `{ name }`. It is idempotent: an entry that is already an object is kept. It runs above `migrateWorld`'s same-version early return, and it covers world stats, entity stats, stat-link overrides, library records and save stat copies. The legacy auto-bind for Stomach, Fatness and Breastsize writes the new form.

**Saved stats (Q17).** A save keeps its own stat copies, bindings included. On load, `refreshSavedStats` also re-reads `morphBindings` and `colorBindings` from the world, as it does scripts and name. An author's binding changes then reach saves in progress.

**Pickers (Q8).** One shared slider picker for stats and traits. It keeps one group per model and splits each into Body Sliders and Head Features, from the morph catalog. It uses the same exclusions as Customization (expressions and lip-sync stay hidden). The cache holds the split, so owned stats get it too. Each model shows as two groups headed "<Model> · Body Sliders" and "<Model> · Head Features" (no picker component change). A non-VRM entity model has no head catalog, so all its keys list under Body Sliders. The rule that hides a slider another stat uses goes, with `boundMorphNamesExcluding` (Q9).

**Stat editor (Q11).** The Body Sliders multi-select stays. Below it, each picked slider gets a row with a Change By number. A Colors list below that adds rows of a channel and a target color.

**Trait editor (Q12).** A matching section holds rows of a slider and its Set To value, and rows of a channel and its color. The editor warns when another trait sets the same control, unless the two can't be active together (one pick-one group) (Q4).

- The section sits on the trait's Stats tab, below Body. Its field takes the stat editor's label, so the two match. A new row starts at Set To 1 (picking a slider usually means "show it").
- The warning reads "Also set by <traits>. The trait switched on last wins.", and each name links to its trait.
- Rivals: a world trait against the other world traits; an owned trait against its owner's own traits. World traits against a played entity's own traits don't warn. Pick-one siblings never warn. Automatic traits warn like Optional ones.
- The match is by name, and by resolved key when the known model is loaded, so Fat and Thickness warn on a model where they alias to one key.
- A linked trait's known model is the link owner's model.
- The resolver's holder map is `holders: Record<modelKey, { ownerId: string | null; traitId: string }>`. Ticket 04 adds color channels to it. Ticket 05 resolves the trait's name.
- Colors (ticket 04):
  - The resolver returns a separate `colorHolders` keyed by channel, beside `holders`.
  - A stat holds at most one color binding per channel, and a trait at most one color pin per channel.
  - The Colors field mirrors Body Sliders: a multi-select of Skin, Eye and Hair, then one row per channel with the design-system ColorPicker.
  - A new row starts at the known model's own color for that channel, or #ffffff when no model is known.
  - The headless loader reports the model's channels. A non-VRM owner has none, so its color rows read "not on this model".
  - Blend steps follow the stats' tree order.
  - The overlap note and the rival rules match the Slider Pin rules.
  - Labels: the field is "Colors"; the column is "Target Color" in the stat editor and "Set To" in the trait editor. History labels read "Colors".
  - Glossary: **Color Pin**.
- Glossary: **Slider Pin**, a trait row that holds one Avatar slider at a Set To value while the trait is active. The Body rule widens to "the latest-on active trait row wins" for Body, slider and color rows.

**Missing controls (Q14).** A binding whose slider or channel the model lacks has no effect in play. The editor marks the row "not on this model" when it knows the model. The known model is the world's player Avatar (the one a new game uses) for world stats and traits, and the owner's model for owned stats and traits. A world with no fixed Avatar shows no mark.

**Stat-link overrides.** The override editor's Body Sliders field gets the same Change By rows (and, in ticket 04, the Colors list), so an override carries the full binding list.

**Help vectors.** `build:help-vectors` runs once at the spec close, not per ticket.

**Character Customization (Q7, Q18).** In the new-game flow, the trait step comes before the Avatar step. Customization reads the traits the player checked there; Automatic traits and item grants are not evaluated yet. A slider or color one of those traits sets shows locked, with a note naming the trait. The stored player value stays, and returns when the trait ends. Customization in the Model Library has no world and locks nothing.

**Scope (Q6, Q19).** The player's Avatar and entity Avatars both use the resolver. An entity reads its own stats and traits. An entity with a non-VRM model keeps its stat sliders and skips color bindings and color pins.

**Docs and copy.** These all describe one stat per slider or the old math, and change with the feature:

- the stat editor's Body Sliders hint;
- the World Editor stats page, the world format page and the Avatars page;
- the history labels, which also cover the new fields.

The changelog gets an entry. The help vectors are rebuilt after the docs change.

## Testing Decisions

A good test calls the real resolver, migration or editor with world-shaped input and checks the visible result: the final value of a slider, the color plan, the trait named as holder, the saved field. It never copies the math into the test.

- **The resolver (main seam).** Prior art: `bodyMorphs.test.ts`. Cases:
  - `by` defaults to 1 and matches today's results for the same inputs, including a player value of 0.5 plus a full stat giving 1.5.
  - Above the authored max keeps growing; a raised live max doesn't shrink; percentage caps at 1.
  - Negative `by` shrinks. Two stats on one slider sum. A stat off by `enabled` or by a trait toggle adds nothing.
  - A trait replaces the player's value, and stats add on top. An inactive trait leaves the player's value.
  - The latest switch-on wins between two traits. Tree order breaks a tie. An active trait missing from `traitsOn` counts as switched on last.
  - An alias pin on Fat replaces a customization value on Thickness, and the output uses the model's name.
  - Color plans: "none" when nothing applies; the player's color as start; blend steps in authored order; `t` clamped at 1.
  - A missing slider or channel is ignored. The holder map names the winning trait.
- **The migration.** Prior art: `version.test.ts`. String bindings become objects on a current-version world, on entity stats, on stat-link overrides, on library records and on save stat copies. Running it twice changes nothing. The legacy auto-bind writes the new form.
- **Saved-stat refresh.** Prior art: the `refreshSavedStats` tests. A binding changed in the world shows in a loaded save.
- **The switch-on order.** Prior art: `settle.bodies.test.ts`. A trait with only slider or color rows joins `traitsOn`, and Body picks don't change.
- **The editor rows.** Prior art: `StatManager.bodySliders.test.tsx`.
  - Change By rows follow the multi-select.
  - Head Features appear in the picker.
  - A slider another stat uses stays pickable.
  - "Not on this model" shows.
  - The overlap warning shows on the trait editor, and not for a pick-one pair.

Each new guard is mutation-tested (the `test-bar` skill): reinstate today's last-wins for two stats, drop the trait replace, clamp `t` at 1 for number stats, and skip the always-run migration. Check that the right test fails each time.

The viewer's per-material blend is outside these seams. It gets a Playwright frame check on a model with two skin materials.

## Out of Scope

- Shipping the Cat Ears and Fox Tail build of Aurelia (Q15). It is a separate effort. The scratch model at `.scratch/ear-shape/aurelia-kemono.vrm` serves as a fixture for manual checks only.
- Extra material colors (clothing and accessories) as binding targets.
- Hair style and hair length as binding targets.
- Colors on non-VRM entity models (Q19).
- Per-link overrides of trait pins (Q20).
- Evaluating Automatic traits or item grants for Customization's lock before play (Q18).
- Script access to the new bindings.
- Any change to how stats are computed.

## Further Notes

- ⚠️ Export shape. World `.json`: stat `morphBindings` entries become objects. Stats and stat-link overrides gain `colorBindings`. Traits gain `morphPins` and `colorPins`. Save `.json`: its stat copies (`globalStats`, `entityStats`) take the same binding forms. `BodyRuntime.traitsOn` lists more traits under the same shape.
- The glossary's Body rule ("the latest-on active trait Body row wins") should widen to cover slider and color rows. Add a glossary term for the trait rows when the first ticket lands.
- Two sources define what players expect: the Aug 7 fix (anchor to the authored max) and the v1.2 rule ("these stats CAN exceed 100%"). The resolver tests pin both.
