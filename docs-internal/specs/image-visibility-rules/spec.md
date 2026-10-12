# Image Visibility Rules and Stat Conditions

Status: done
Status note: Closed 2026-10-12. Tickets 01-10 done. Last landing 24a80f883; review fold-in 9955a4d60. Closed without gates.
Spec session: image-visibility-rules — spec

## Problem Statement

An entity's gallery is a fixed list. Slot 0 shows everywhere, and in play the player pages through the rest by hand. The art never follows the story. An author cannot say:

- "Show the wounded portrait while her Health is under 20%."
- "Show the armored portrait while she has Knight and the player has Trusted Ally."
- "Hide the human form while Werewolf is active."

The only tool today is a description that asks the player to picture it. Trait gates have the same hole from the other side: an Availability rule reads traits and personas, never a number. "Berserk needs Rage at 80 or more" cannot be written.

## Solution

- **Stat Conditions.** The Requirement Row grammar gains one Condition kind: a bearer's stat compared to a number. Six operators (`>`, `<`, `>=`, `<=`, `=`, `≠`). The number is raw, in the stat's units, or a percent of the stat's min→max span, author's pick per Condition. Trait gates and image rules share the kind, the rows editor and the evaluator.
- **Traits settle every turn.** Stat-gated traits turn off when their Condition stops holding and return when it holds again, through the existing cascade-off list. The stat is read once per commit, as it stands after the turn's stat pass; a trait's own stat effects never re-trigger a settle in the same commit.
- **Visibility rules on gallery images.** Each image in an entity's gallery can carry Requirement Rows. In play the image is visible while any row holds. The primary is the first visible image in author order. An image with no rows is always visible. Outside play (library grid, listing art, character card pixels, setup) slot 0 shows and rules are ignored.
- **The editor.** A cog on each gallery thumbnail opens the same rows editor in a popover. A badge marks a thumbnail that carries a rule. The rule's summary sentence ("Shown while Health < 20% and not Healed") sits under the selected thumbnail. The editor warns when slot 0 carries a rule.
- **Test Bench** flags the new traps: a rule that names a missing trait or stat, an entity whose every image can hide, a stat gate on a trait that changes that stat, a percent Condition on a stat whose min equals its max.

Entities only. Locations carry one background image and are a later effort.

## Rulings

Settled in the grill, 2026-10-12. A ruling reopens on new evidence, never on a new opinion.

| Q | Ruling |
|---|---|
| Q1 | Image rules reuse Requirement Rows. A new `stat` Condition kind joins the grammar. Trait gates gain it too. |
| Q2 | A stat Condition compares a raw number or a percent of the stat's span. Author picks per Condition. |
| Q3 | Any bearer, through the existing bearer model. An image rule's default bearer is the image's own entity. |
| Q4 | In play the primary is the first visible image in author order. Every image hidden means no image. |
| Q5, Q15 | Six operators: `>`, `<`, `>=`, `<=`, `=`, `≠`. |
| Q6 | Cog on the thumbnail opens the rows editor in a popover. Badge on conditioned thumbnails. Summary under the selected thumbnail. |
| Q7 | Image rules evaluate at turn commit. |
| Q8 | Outside play slot 0 shows, rules ignored. The editor warns when slot 0 carries a rule. |
| Q9 | Traits settle every turn commit. Stat-gated traits cascade off and return through the cascade-off list. |
| Q10 | Paging keeps the current image when it stays visible, else lands on the primary. |
| Q11 | A gallery image becomes an object: data plus optional rows. Migration wraps the string form. |
| Q12 | An unresolved trait or stat hides the image. Test Bench warns. |
| Q13 | Stats are read once per commit, after the stat pass and before this settle's trait effects. No second settle in the same commit. Test Bench flags a trait whose gate reads a stat it changes. |
| Q14 | Show-when only. Per-chip Not covers hiding. |
| Q16 | Grilled as "hide the percent toggle for unbounded stats". Evidence after the grill: every stat carries a min and a max, so no stat is unbounded. The toggle always shows. Zero span: see Q22. |
| Q17 | The term is **Visibility rule**. The summary reads "Shown while …". |
| Q18 | One spec. Trait-side tickets land first; image tickets build on them. |
| Q19 | Every settle inside one commit reads one frozen stat snapshot, captured after asks, regen, starvation and `code` land. Mid-commit settles from stat-code trait switches read the same snapshot as the final settle. |
| Q20 | Static gate analyses (never unlockable, dead rows, unstable cycles) treat a stat Condition as satisfiable both ways. Setup defaults settle against starting values. |
| Q21 | A Condition on an inert stat (`enabled: false`) is unresolved and does not hold. The player's requirement line leaves it out, like a hidden stat. |
| Q22 | Reopens Q16 on evidence: descriptor geometry reads a zero-span stat as 0%. A percent Condition reads the same 0%. Test Bench still warns. |
| Q23 | (Ticket 01 intent, 2026-10-12) Setup defaults settle against each stat's authored start with authored min and max, before any picked trait's stat effects. A pick whose effect would open another gate opens it at the first commit in play, not at setup. |
| Q24 | (Ticket 01 intent, 2026-10-12) Card import binds an outward stat Condition like a trait Condition: keep an id the world holds, else the one stat carrying the stored name, else clear the id and stay unresolved. The entity's own stats keep their ids. Lands in ticket 01. |
| Q25 | (Ticket 01 intent, 2026-10-12) The name match in Q24 is scoped by bearer, since stat names repeat across entities. An entity bearer matches among that entity's stats, own plus linked; `you` among the world's player stats; no bearer pointing outside the entity among the world's stats. A record with no stat list keeps the stored id. Test Bench's opening model settles defaults against the same authored-start stats as Enter World (Q23), in ticket 01. |
| Q26 | (Ticket 02 intent, 2026-10-12) The per-turn settle follows the stat-code switch path: log lines ("Trait switched off: Berserk"), no cascade banner. A banner from a hand switch is not cleared by the next turn. Open to reopen after the user sees it in play. |
| Q27 | (Ticket 04 intent, 2026-10-12) On the Availability tab the chips are the rule's sentence. The parked requirement summary stays parked and the mode sentence lists no Conditions. The player-facing rule text helpers render stat Conditions; ticket 08's "Shown while" line uses them. |
| Q28 | (Ticket 04 intent, 2026-10-12) In the editor the `you` bearer lists the player owner set for persona 'none': the world's player stats plus the Custom Persona entity's own stats. A world persona's own stats stay under that entity's bearer. |
| Q29 | (Ticket 06 intent, 2026-10-12) Image rows travel through the same four card paths as trait rows: named on export, bound on import under Q24/Q25, re-pointed when owned traits re-mint, compared by name. Stories 33–34 land in ticket 06. |
| Q30 | (Ticket 06 intent, 2026-10-12) The card JSON carries slot 0's rows as `primaryImageRequires` beside the object-element `extraImages`. |
| Q31 | (Ticket 06 intent, 2026-10-12) Replacing an image in place keeps the slot's rule; delete drops the rule with the image; reorder carries it. |
| Q32 | (Ticket 02 intent, 2026-10-12) The before box (stat code at turn start) is its own run with its own snapshot: its writes landed, no switch effects yet. No per-turn settle follows it. The per-turn settle runs once after the after-AI run, before the turn snapshot arms. |
| Q33 | (Ticket 02 intent, 2026-10-12) Stat code's `traits.X.available` resolves stat Conditions against the run-start stats. The editor's code test run and the Test Bench code check read authored-start stats (Q23) so a test run agrees with Enter World. Landed as a drop-in in ticket 02; no Backlog entry. |
| Q34 | (Ticket 07 intent, 2026-10-12) The entity image follows the viewed turn, like the stat and trait panels, so it agrees with the stat bar beside it. |
| Q35 | (Ticket 07 intent, 2026-10-12) Visibility is derived, never written. The stored gallery index is the author-order image the player last paged to; the viewer shows it while visible and the primary while it is hidden, and returns to it when it comes back. Viewing a turn never writes gallery state. Refines Q10. |
| Q36 | (Ticket 07 intent, 2026-10-12) The in-play persona picker shows slot 0 for every option, the current persona included. Picker lists are catalog surfaces and show covers; the persona row beside the game shows the visible primary. |
| Q37 | (Spec review, 2026-10-12) The stat chip's operator is a dropdown, not a segmented control. Six symbols in a row took too much room on a small control. The user's call on seeing it. |

### Spec review fold-in (2026-10-12)

An Opus review of the landed code against this spec found no ruling broken. Folded in on main after the tickets closed: the operator dropdown (Q37); the zero-span percent warning on image rules (`image-rule-percent-zero-span`); complementary stat pairs in the all-hideable check; the `stat` kind in the World Format doc; stop-gap wording removed from the changelog and the stat-gated-trait entry moved to the player bucket. The re-generate and re-roll settle was already covered by the per-turn settle test, so no test was added.

## Backlog

Correct behavior with a known rough edge, left for a later effort:

- **Q26 banner.** The per-turn settle writes log lines only. The user may want a cascade banner after seeing it in play.
- **Semantic help search** misses "can a trait need a stat" in its top five and ranks "show image when hurt" second. Keyword search ranks both first. Ticket 10 comments have the numbers.
- **A fully hidden entity can still win the panel slot.** The panel picks by authored gallery, so an entity whose every image is hidden and that has no model can show an empty frame while another entity has a visible image.
- **An image ruled on a switched-off stat hides with no image-side warning.** The missing-target rule skips inert stats on purpose (Q21); the stats rules judge them.
- **`= 20.5` can never hold.** `=` and `≠` round the reading, but the value box accepts decimals. Either clamp the box to the stat's display precision or round the value on entry.
- **Zero-span `= 0%` always holds.** Q22's 0% reading means a percent `=` Condition on a flat stat is always true. Both zero-span rules warn.

Review notes (Opus second opinion, 2026-10-12) that shaped the Implementation Decisions without a ruling: card codec drops unknown Condition kinds; slot 0 travels as card pixels with no JSON home for its rule; requirement equality ignores operator and value; growth treats every Not as holding; the gallery index is a raw position; the `you` bearer must cover persona stats; re-generate and stat re-roll replay stat code; settle on load already exists.

## User Stories

### Stat Conditions in a rule

1. As an author, I want a Condition that compares a stat to a number, so that "Rage >= 80" gates a trait.
2. As an author, I want six operators, so that any threshold reads the way I would write it in math.
3. As an author, I want a Condition to compare a percent of the stat's span, so that "Health < 20%" survives a later change to the max.
4. As an author, I want the raw/percent choice per Condition, so that "Gold > 100" and "Health < 20%" sit in one row.
5. As an author, I want a stat Condition on another bearer, so that "Ash: Hunger > 70" gates the player's trait.
6. As an author, I want a stat Condition on the played persona, so that an entity's image follows the player's Health.
7. As an author, I want Not on a stat Condition, so that "not Health = 0" is one chip.
8. As an author, I want the stat picker to list the bearer's own stats and the world's player stats, so that I never type a name.
9. As an author, I want the summary sentence to read a stat Condition in plain words, so that the rule is understood without the editor.
10. As a player, I want a trait's requirement line to show stat Conditions the same way, so that I know what number to reach.
11. As a player, I want a hidden stat left out of my requirement line, so that the author's secret stays secret.

### Traits that follow stats in play

12. As a player, I want a stat-gated trait to turn off when its stat falls below the threshold, so that Berserk ends when Rage drains.
13. As a player, I want that trait to return when the stat recovers, so that Berserk comes back at 80 without my hand.
14. As a player, I want the trait's stat effects to reverse when it cascades off, so that my numbers stay honest.
15. As a player, I want a trait I switched off by hand to stay off even when its gate holds, so that the game does not fight me.
16. As a player, I want traits to settle once per turn, so that a stat animating up and down never flickers a trait.
17. As an author, I want a trait that changes a stat its own gate reads to be flagged, so that I notice the loop before a player does.
18. As an author, I want gates with no stat Conditions to behave exactly as before, so that my shipped worlds do not change.
19. As a player, I want a save made before this change to load and settle without losing traits, so that my playthrough continues.

### Visibility rules on images

20. As an author, I want a Visibility rule on any gallery image, so that a portrait shows only in the right state.
21. As an author, I want the rule to use the same rows, chips, And, Or Another Way and Not as trait gates, so that I learn one editor.
22. As an author, I want the rule's default bearer to be the image's own entity, so that "Health < 20%" means her Health without a picker trip.
23. As an author, I want a rule to read the player's traits and stats, so that "you have Night Vision" shows the true form.
24. As an author, I want an image with no rule to always show, so that nothing changes for galleries without rules.
25. As an author, I want author order to decide which visible image is the primary, so that the fallback goes last and the special states go first.
26. As an author, I want a cog on each thumbnail that opens the rule, so that the rule sits next to its picture.
27. As an author, I want a badge on a thumbnail that carries a rule, so that I see which images are conditioned without opening each one.
28. As an author, I want the summary sentence under the selected thumbnail, so that I read the rule without opening the cog.
29. As an author, I want a warning when slot 0 carries a rule, so that I know the cover image shows everywhere outside play regardless.
30. As an author, I want reorder and delete to carry each image's rule with it, so that a rule never lands on the wrong picture.
31. As an author, I want a hidden-everywhere entity flagged in Test Bench, so that a player never meets a blank frame by accident.
32. As an author, I want a rule that names a deleted trait or stat flagged in Test Bench, so that the image does not vanish silently.
33. As an author, I want a Visibility rule to survive export as a character card and import into another world, so that my card keeps its states.
34. As an author, I want a rule whose trait or stat the new world lacks to rebind by unique name where it can, so that a shared stat name still works.

### Visibility in play

35. As a player, I want the entity's shown image to change when a turn commits, so that the wounded portrait appears as the stat bar drops.
36. As a player, I want paging to skip hidden images, so that I never see a state that is not true.
37. As a player, I want to stay on the image I was viewing when it stays visible, so that a turn does not yank the viewer.
38. As a player, I want the viewer to land on the primary when my image hides, so that I always see a true state.
39. As a player, I want the zoom viewer and the panel to agree on the visible set, so that the two never show different pictures.
40. As a player, I want an unresolved rule to hide its image, so that a broken card never shows a wrong state as true.
41. As a player, I want the library grid, listing art and setup screen to keep showing slot 0, so that an entity's cover is stable where no game state exists.
42. As a player, I want a loaded save to show the right image at once, so that the first frame after load is not stale.

### Help and Test Bench

43. As an author, I want a help topic for Visibility rules and stat Conditions, so that the help window answers "how do I show a portrait only when hurt".
44. As an author, I want Test Bench to flag a percent Condition on a stat whose min equals its max, so that a span of zero never silently fails.

## Implementation Decisions

### Grammar

- `TraitRequirement` gains a fourth kind: `stat`. Fields: stat id, stored name, optional bearer, operator, value, unit (`raw` | `percent`), optional `not`. Unit reuses the existing `ThresholdUnit` type, so percent means the same share of min→max as descriptor thresholds, including the zero-span reading of 0% (Q22).
- "Own entity" is stored as an absent bearer, as trait rows do. A card import mints a new entity id, so an explicit self id would stop resolving after import.
- Requirement equality, the chip editor's duplicate check, the requirement summary and the portable-trait comparison all include operator, value and unit. "Rage > 20 and Rage < 80" is two Conditions, not a duplicate.
- The rule text helpers render a stat Condition as `<name> <operator> <value>` with `%` appended under percent. The player's line follows the same Hidden filtering as trait Conditions: a Condition on a hidden or inert stat is left out, and a row left with none is dropped.
- The chip picker lists, per bearer, that bearer's own stats. The `you` bearer reads the same owners as the player owner set: in the editor, where no persona is played, that is the world's player stats plus the Custom Persona's own stats (Q28); in play it includes the played persona's own stats. Blueprint stats resolve through the owning entity's links as they do elsewhere.

### Evaluation

- The gate evaluator's input gains per-owner stat values: owner id → stat id → `{ value, min, max }`, using the effective min and max in play. Trait and group resolution is unchanged. A stat Condition resolves against its bearer's set; a missing stat, an inert stat (Q21) or a missing bearer is unresolved and the Condition does not hold, like an unresolved trait.
- A stat Condition evaluates directly during growth. It does not depend on the active set, so it never takes the Not-holds-during-growth shortcut, and a failed pick is never blamed on an unrelated returner.
- `=` and `≠` compare the rounded display value for raw and the rounded percent for percent, through the same rounding the stat bar and descriptor geometry use, so a bar reading 20 and a Condition `= 20` agree.
- **One snapshot per commit (Q13, Q19).** Stats land in several steps inside a commit: AI asks, regen, the starvation penalty and `code` writes, each a queued updater. Stat-code trait switches call settle while those are landing. The commit captures one stat snapshot after all four have landed, and every settle in that commit reads it: the settles that stat-code switches trigger and the final per-turn settle alike. Trait effects that the settles produce apply after the read; nothing re-reads. The final settle runs in the commit applier before the turn snapshot is armed. Trait toggles by hand and persona switches keep their existing settle calls and read live values.
- Re-generate and stat re-roll replay stat code; both settle once after the replay, against the same kind of snapshot.
- Settle on load already exists as an effect after the first render. It gains stat values and no new step.
- Static gate analyses treat a stat Condition as satisfiable both ways (Q20). Setup defaults settle against starting values.

### Images

- `Entity.images` changes element type from a data string to an object `{ data, requires? }`, where `requires` is the same rows type trait gates use. The `entityImages` reader returns the objects; a sibling helper returns the data strings for callers that only paint. Migration wraps every string in place, in `migrateWorld`, the character card codec and the library read, mirroring how Requirement Rows wrapped the flat form.
- Every writer that rebuilds the array walks the object: image optim core, the remote-image embedder, the WebP fix, the downscale prompt, the MainMenu import, the ST persona import, the Tavern card import and the backup index. The type change breaks their compile, which is the checklist.
- A pure visibility helper takes the entity and the gate input and returns the visible images in author order. The stored per-entity gallery index stays an author-order index. The gallery hook maps it onto the visible list: the player's image shows while it is visible, the primary shows while it is hidden, and the index itself is never rewritten by a hide (Q35). The visible list is passed into the entity visual as a prop, so the panel, the zoom viewer and the persona row share one list and never build their own.
- The persona row in play shows the visible primary, not slot 0.
- When every image hides and the entity has a 3D model, the model shows. The model is not an image and carries no rule.
- Visibility is derived each render from gameplay state that changed at commit. Nothing new is saved.
- Character card pixels, listing art and the library grid keep reading slot 0 through the primary helper.

### Editor

- The gallery thumbnail gains a hover cog and a rule badge. The cog opens a popover that mounts the rows editor with the entity as default bearer. The Requires field today takes a trait and reads the trait store, so the rows editor is lifted to a rows-and-owner-shaped component that both the Availability tab and the popover mount. The popover sits inside the entity editor dialog, so it uses the modal popover mode.
- The summary sentence under the selected thumbnail reuses the rule text helpers with the "Shown while" lead.
- A slot 0 rule shows an inline warning under the thumbnail, not a blocker.
- The picker gains a Stats section per bearer; picking a stat opens the operator and value controls on the chip. Operator is a dropdown of six symbols (Q37). Unit is a two-state toggle, raw units or `%`.

### Test Bench

- The existing unresolved-requirement rule learns the stat kind, so a rule that names a missing stat reports there. No separate missing-stat rule.
- `image-rule-missing-target`: an image rule names a missing trait, group or stat.
- `entity-images-all-hideable`: every image carries a rule and no pair of images carries complementary single Conditions: `X` / `not X`, or two stat Conditions on one reading whose operators split the number line (`> n` / `<= n`, `< n` / `>= n`, `= n` / `≠ n`), Not folded in.
- `image-rule-percent-zero-span`: a percent Condition in an image rule on a stat with `min === max`. The trait-side twin is `requirement-percent-zero-span`.
- `trait-gate-reads-own-stat`: a trait's gate reads a stat the trait changes, including changes to that stat's min or max and stat toggles, since percent reads the effective max.
- `requirement-percent-zero-span`: percent on a stat with `min === max`.
- The slot 0 warning is editor-only, not a Test Bench rule.

### Export shape

- World `.json`: `images` elements become objects.
- Character card JSON: the codec accepts the `stat` Condition kind; today it drops any other kind and the row with it, so a stat-gated trait would import with a looser gate. `extraImages` elements become objects. Slot 0 travels as the card pixels, so the card gains a field for slot 0's rows.
- Both changes are additive in intent, but a reader of the old form must be migrated. The response that lands each shape ticket carries the export-shape reminder.

## Testing Decisions

A good test calls a seam with inputs a player or author could produce and asserts what they would see: which traits are on, which images are visible, what the sentence says. No test asserts call order or internal lists.

- **Gate evaluator**: six operators at the boundary value, raw and percent, Not, bearer `you` and entity, unresolved stat, unresolved bearer, zero span. Prior art: the existing gate tests with and/or/not rows.
- **Trait runtime per-turn settle**: a stat-gated trait across three commits (off, on, off); effects reverse on cascade; a hand switch-off stays off; a self-feeding trait settles once and does not oscillate within a commit; a stat-code switch mid-commit and the final settle read the same snapshot. Prior art: the runtime tests for cascade-off and return.
- **Static analyses**: a stat-gated trait is not reported never-unlockable; a dead row still is when its trait Conditions conflict. Prior art: the never-unlockable rule tests.
- **Visibility helper and gallery hook**: primary is first visible; all hidden yields none; paging keeps place or falls to primary; index outlives a shrink. Prior art: the gallery hook tests.
- **Migration and card codec**: string form wraps; object form round-trips through the card and back, including slot 0's rule and a stat Condition; a rule on a card dropped into a world without the stat rebinds by unique name or stays unresolved. Prior art: the Requirement Row migration tests and the card codec tests.
- **Requires field**: picking a stat shows operator and unit; the chip renders the sentence; Not flips. Prior art: the existing Requires field tests.
- **Test Bench**: each rule fires on a minimal world and stays silent on its clean twin. Prior art: the `trait-requirement-unstable` rule tests.
- **Mutation**: each new guard is proved by reinstating its bug once, per the test bar.

## Out of Scope

- Location background images and scene images.
- A hide-when direction on a rule (Q14).
- Rules on anything other than traits and gallery images.
- AI awareness of which image is shown. Images never reach the narrator.
- Narration or stat-pass prompt changes.
- Re-settling within a commit after trait effects apply (Q13).
- Rules on 3D models.

## Further Notes

- Q9 makes settle run on every commit for every world. Gates without stat Conditions produce the same set as before, but the cost is now per turn. Keep the evaluator's per-commit work bounded by the owners present.
- Percent shares the descriptor-threshold definition on purpose. One meaning of "%" across the stat system.
- The player-facing term for the mechanic is **Visibility rule**; the trait side keeps **Availability rule**. Glossary entries go to `CONTEXT.md` with the terms ticket.
