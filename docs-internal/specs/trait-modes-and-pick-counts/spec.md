# Trait Modes and Pick Counts

Status: ready-for-agent
Spec session: trait-modes-and-pick-counts — spec

## Problem Statement

An author can say "pick at most one" for a trait group, but nothing else about how many picks a group needs. A world that needs "choose a class" or "choose two starting skills" can only ask in a description. The player can start with no class, and the narration then has nothing to work with.

Every trait is also something the player chooses. An author has no way to say:

- "This is always true of you." A trait can be a default, but the player can uncheck it on the setup screen.
- "Picking this brings a curse." A requirement can unlock a trait, but the player must still choose to take the curse.
- "This is in effect, but the player doesn't know." Every trait shows in the setup screen and the Traits panel, so a hidden bonus or a secret nature can't exist.

## Solution

- **Pick counts.** A trait group has an optional minimum and maximum number of picks. The editor offers Any, Exactly One, Up to One, and Custom (at least N, at most M). "Up to One" is today's exclusive group, and it still renders radio buttons. Only traits placed directly in the group count.
- **Trait modes.** Each trait has one of three modes:
  - **Optional:** today's behavior.
  - **Always On:** active exactly when its gate holds. It's always on when it has no requirements. The player can never switch it. A curse is an Always On trait that requires the cursed item. Picking the item brings the curse, and dropping the item lifts it.
  - **Hidden:** Always On, and the player never sees it. The AI sees it like any active trait.
- **Setup screen.** Begin stays disabled until every group meets its minimum. Quick Start never blocks.
- **Test Bench** catches the traps: defaults that don't meet a minimum, a minimum that can't be met, an impossible count, and Always On traits or defaults that exceed a maximum.

## User Stories

1. As an author, I want to require at least one pick from a group, so that every player chooses a class.
2. As an author, I want to require exactly two picks from a group, so that players choose two starting skills.
3. As an author, I want a group limited to at most N picks, so that a player can't take every perk.
4. As an author, I want common counts offered as presets, so that I don't type numbers for the usual cases.
5. As an author, I want a Custom option with "at least" and "at most" fields, so that I can set any range.
6. As an author, I want my existing exclusive groups to keep working as "Up to One", so that nothing changes in worlds I already made.
7. As an author, I want only traits placed directly in a group to count toward its limits, so that subgroups set their own counts and nothing surprises me.
8. As an author, I want to mark a trait Always On, so that it's a fixed fact about the character.
9. As an author, I want an Always On trait that requires another trait, so that picking a cursed item applies a curse the player can't remove.
10. As an author, I want the curse to lift when its source is dropped, so that the curse follows the item.
11. As an author, I want to mark a trait Hidden, so that a secret bonus or nature is in effect without the player seeing it.
12. As an author, I want Hidden to imply Always On, so that I can't make a hidden trait the player could never pick.
13. As an author, I want the Default and Player Can Toggle fields gone for Always On and Hidden traits, so that I can't set a value that means nothing.
14. As an author, I want a trait's mode set with one three-way control, so that an invalid combination can't be authored.
15. As an author, I want a trait link to override the mode per bearer, so that one bearer has a trait innately and another picks it.
16. As an author, I want pick counts and modes to work the same on entity-owned traits and groups, so that I learn one rule set.
17. As an author, I want Test Bench to report an error when a group's defaults don't meet its minimum, so that my world starts with no options changed.
18. As an author, I want Test Bench to report an error when a group can't unlock enough traits to meet its minimum, so that I don't ship a world nobody can start.
19. As an author, I want Test Bench to report an error when a minimum is above the maximum, so that I fix an impossible count.
20. As an author, I want Test Bench to warn when Always On traits that can be active together exceed a group's maximum, so that I see the conflict.
21. As an author, I want Test Bench to warn when a group's defaults exceed its maximum, so that I know some defaults won't apply.
22. As an author, I want Test Bench to check every bearer for these rules, so that a linked group is checked where it is used.
23. As an author, I want a requirement to point at an Always On or Hidden trait, so that a hidden bonus can unlock other traits.
24. As a player, I want the setup screen to show how many more picks a group needs, so that I know why I can't begin.
25. As a player, I want Begin disabled until every group has enough picks, so that I don't start with an incomplete build.
26. As a player, I want Quick Start to always start, so that a world with an authoring mistake is still playable.
27. As a player, I want the other rows in a full group disabled, so that I know to uncheck one before picking another.
28. As a player, I want a group limited to one pick to keep its radio buttons, so that swapping a pick stays one click.
29. As a player, I want an Always On trait shown as active with no switch, so that I know it's part of my character.
30. As a player, I want a curse to appear only when it takes effect, so that I discover it when it lands.
31. As a player, I want a curse to go away when I drop its source, so that I can undo a bad choice.
32. As a player, I want to be stopped from switching off a trait mid-game when that drops its group below the minimum, so that my build stays valid.
33. As a player, I want a group that loses a trait through a gate failure to stay short without a prompt, so that play isn't interrupted.
34. As a player, I want the trait to return to that group when its gate holds again, so that the gap closes on its own.
35. As a player, I want an Always On trait to block its max-one group's other picks, so that the rules stay consistent.
36. As a player, I want gate lines to leave out requirements I'm not meant to see, so that a hidden trait's name never shows.
37. As a player, I want a locked trait whose requirements are all hidden to read just "Locked", so that nothing leaks.
38. As a player, I want hidden traits left out of the history, stat attributions and every other screen I see, so that the secret holds.
39. As a player, I want the narration to reflect hidden traits, so that the story treats my character as the author intended.
40. As a player, I want a hidden trait's stat changes to apply, so that a hidden bonus has real effect.
41. As an author debugging a world, I want the Prompt viewer and Test Bench to show hidden traits, so that I can check they apply.
42. As a player loading an older world, I want its exclusive groups to behave exactly as before, so that the upgrade is invisible.

## Implementation Decisions

**Rulings (grill, 2026-09-29).** A settled ruling reopens on new evidence, not on a new opinion.

| # | Ruling |
| --- | --- |
| Q1 | Pick counts, Always On and Hidden are one effort. |
| Q2 | An Always On trait is active exactly when its gate holds. No requirements means always active. |
| Q3 | Only direct children count toward a group's min and max. Exclusive already works this way, and every group rule matches it. |
| Q4 | A Hidden trait may carry stat changes. Visible stat bars move. |
| Q5 | A group stores `minPicks` and `maxPicks`. `migrateWorld` turns `exclusive: true` into `maxPicks: 1`. A max of 1 renders radio buttons. |
| Q6 | Mid-game, a player switch-off that drops a group below its minimum is refused. |
| Q7 | Mid-game, a gate failure may drop a group below its minimum. There is no prompt. |
| Q8 | Always On traits count toward their group's min and max. |
| Q9 | An unmet minimum disables Begin on the setup screen. Quick Start never blocks. It starts with the gap left in place. |
| Q10 | At a group's max (above 1), the unchecked rows disable. A max-1 group keeps its radio swap. |
| Q11 | The same rules apply to entity-owned traits and groups, for every bearer. |
| Q12 | A trait link may override the mode. |
| Q13 | There are three modes. Always On means on whenever the gate holds, never toggleable. Hidden means Always On and not shown. The UI allows no invalid mix. |
| Q14 | Gate lines leave out hidden requirements. When every requirement is hidden, the line reads "Locked". |
| Q15 | A dormant Always On trait (gate not holding) isn't shown until it activates. |
| Q16 | Defaults below a group's minimum is a Test Bench error. |
| Q17 | The mode is one enum field. Absent means Optional. |
| Q18 | The editor labels are Optional / Always On / Hidden. |
| Q19 | The AI sees a Hidden trait like any active trait. There is no marker and no prompt change. |
| Q20 | A Hidden trait's name shows only in dev and debug tools, the Prompt viewer and Test Bench. |
| Q21 | The editor offers a count preset (Any / Exactly One / Up to One / Custom). Custom shows "At least" and "At most" fields. |
| Q22 | Test Bench gets four rules: min unreachable (error), min above max (error), Always On over max (warning), defaults over max (warning). |
| Q23 | Implementation starts right after ticketing. Blueprints and Trait Links are cleared. |
| Q24 | Ticket 01 keeps `TraitSelectionModal` compiling with a one-line `maxPicks === 1` read and names it dead in the ticket's comments. Removing it is the user's call, outside this effort. |
| Q25 | Ticket 01 exports the pick-state query, and the setup list and the Traits tab read it. On Test Bench, 01 only moves the `exclusive` readers to `maxPicks === 1`. Ticket 03's rules are the first Test Bench readers of the query. |
| Q26 | The minimum refusal is mid-game only (Q6). The gate module exports it as a pure query, and the play runtime refuses through it for every bearer. On the setup screen, a switch-off is never refused for the minimum, because refusing it would lock an "Exactly N" group. Begin gates the short group instead (Q9). |
| Q27 | Mid-game, a player switch-off is refused whenever it ends below the minimum, including in a group already short after a cascade. |
| Q28 | Mid-game, an "Exactly N" group with N above 1 can't change. That is accepted. An author who wants swaps sets a range. There is no swap picker. |
| Q29 | An Always On trait whose gate starts to hold in a full group joins anyway. Nothing is retired, so the group runs over its max until the player drops a pick. This matches Q8 and the over-max warning. |
| Q30 | Stat code never switches an Always On or Hidden trait, in either direction. Its gate alone decides (Q2). |
| Q31 | Ticket 04 treats `hidden` as Always On in the gate logic. Ticket 05 adds only the hiding and the editor option. |
| Q32 | `trait-group-always-on-over-max` counts co-activation: it finds the largest set of the group's Always On traits whose gates one selection can open together, respecting max-1 rivals. If that can't stay small and pure, it counts every Always On trait that can ever unlock and accepts the false positives. |
| Q33 | An Enter World category with no visible rows is not shown. This covers categories of only Hidden or dormant Always On traits. It is part of ticket 05. |
| Q34 | A save load settles every bearer against the current world. This is ticket 08. |
| Q35 | Stat code may switch on an Optional sibling beside an active Always On trait in a max-1 group. Stat code ignores pick counts. |
| Q36 | `trait-group-always-on-over-max` may over-report because it ignores Optional groups' maximums. It is a warning, and that is accepted. |

**Schema (world export shape).**

- `TraitGroup` gains `minPicks?: number` and `maxPicks?: number`. An absent min means 0, and an absent max means no limit. `exclusive` leaves the type. `migrateWorld` rewrites `exclusive: true` as `maxPicks: 1` on world groups and entity-owned groups. The migration is idempotent.
- `Trait` gains `mode?: 'alwaysOn' | 'hidden'`. An absent mode means Optional. For a non-Optional mode, `isDefault` and `playerToggle` are ignored.
- `TraitLinkFields` gains `mode`, so a link overrides it like the other fields.
- Saves don't change. Active trait ids and cascade-off lists keep their shape.

**Gate module (`settle`, `switchTrait`, `settleDefaults`).**

- `settle` treats every Always On and Hidden trait whose gate holds as proposed. Such a trait joins the least fixpoint like a picked trait. When its gate fails, it leaves like any cascade-off trait and returns through the same Q34 path.
- `switchTrait` refuses these cases and returns null, like it does for a locked trait:
  - switching an Always On or Hidden trait in either direction;
  - switching off a trait when that drops its group below `minPicks`;
  - switching on a trait in a full group whose max is above 1.
- In a max-1 group, switching on retires the sibling as it does today. The exception is an Always On sibling: it can't be retired, so the switch is refused.
- `settleDefaults` includes active Always On traits and caps defaults at each group's max, keeping authored order. This generalizes `collapseExclusiveDefaults`.
- A new pure query reports each group's pick state per bearer: count, min, max, and whether the group is short or full. The setup screen, the Traits panel and Test Bench all read it.
- `exclusiveSiblings` and every other `exclusive` reader move to `maxPicks === 1`.

**Setup screen and Traits panel.**

- Visibility rules:
  - Hidden traits never show.
  - Always On traits show only while active. They render checked with no control.
  - Rows are disabled at the cap.
  - A group short of its minimum shows how many more picks it needs.
  - Begin is disabled while any group is short.
- Quick Start skips the minimum check.
- Gate lines filter out hidden requirement targets.
- Every player-facing surface leaves out Hidden traits: history, stat attribution and the cascade banners. Dev and debug surfaces keep them.

**Editor.**

- A group gets a count select with Any / Exactly One / Up to One / Custom. Custom shows "At least" and "At most" number fields.
- A trait gets a three-way mode control. Always On and Hidden hide the Default and Player Can Toggle fields.
- The link override UI gains the mode.

**Test Bench (`runRules`).** Each rule runs per bearer through the existing lens.

- **New rules:**
  - `trait-group-min-unreachable` (error): fewer traits can unlock than the minimum. This reuses the `neverUnlockable` least-fixpoint logic.
  - `trait-group-min-above-max` (error).
  - `trait-group-always-on-over-max` (warning).
  - `trait-group-defaults-below-min` (error): defaults plus active Always On traits don't meet the minimum.
- **Changed rules:**
  - `trait-group-multiple-defaults` becomes "defaults over max" (warning) for any max.
  - `trait-group-too-small` reads `maxPicks === 1`.

**AI context.** `buildTraitContext` doesn't change. A Hidden trait reaches the AI as an ordinary active trait, so no probe is needed.

## Testing Decisions

- Tests exercise behavior through public seams and never mirror the implementation. Each new refusal and each new rule gets a guard, and each guard is proved to bite by reinstating its bug (`test-bar` skill).
- **Gate module:** the main seam. It covers:
  - pick-count refusals (Q6, Q10);
  - the Always On sibling in a max-1 group;
  - Always On activation and removal through gates, including the curse chain and its return (Q2, Q7);
  - defaults capped at max, with Always On traits included.
  - Prior art: the existing `traitGates` tests.
- **Test Bench `runRules`:** each of the four new rules and the two changed rules, per bearer, with a linked group. Prior art: the existing trait-gate rule tests and the pure `runRules` seam.
- **`migrateWorld`:** `exclusive` becomes `maxPicks: 1` on world and entity-owned groups. Running it twice gives the same result. Prior art: the existing version migration tests.
- **Component tests** on the setup trait list and the Traits tab, for visibility only:
  - Hidden and dormant rows are absent.
  - Active Always On rows have no control.
  - Rows are disabled at the cap.
  - The short-group count shows, and Begin is disabled.
  - Gate lines leave out hidden names.
  - Prior art: the existing SetupTraitList and TraitsTab tests and the GamePanels harness.

## Out of Scope

- Pick counts that count nested subgroups (Q3).
- A prompt that asks for a replacement pick after a gate failure (Q7).
- Marking hidden traits in AI context, and any prompt change (Q19).
- Hiding whole groups. Hidden is per trait.
- "Locked once picked" traits that the player picks and then can't drop (Q2).
- An end-to-end Playwright pass.

## Further Notes

- ⚠️ **Export shape:** worlds gain `minPicks`, `maxPicks` and `mode`. Shipped worlds' `exclusive` is migrated away, because `exclusive` has been in releases since v2.9.0. Trait requirements and links are unreleased, so they need no compat.
- `TraitSelectionModal` appears to be dead code, because only its test imports it. Ticket 01 confirmed this and keeps it compiling (Q24).
- The glossary (`CONTEXT.md`) needs entries for Always On, Hidden (trait) and Pick Count.
