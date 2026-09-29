# 05: Hidden traits

Status: ready-for-human
Base: 7613dbe7
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: small logic on top of Always On; the work is a sweep of every player-facing surface for leaks.

Parent: [Trait Modes and Pick Counts spec](../spec.md)

## What to build

An author can mark a trait Hidden. Hidden is Always On that the player never sees (Q13). The AI sees it like any active trait, with no marker and no prompt change (Q19). Its stat changes apply (Q4). Its name shows only in dev and debug tools, the Prompt viewer and Test Bench (Q20). A visible locked trait's gate line leaves out hidden requirements, and reads "Locked" when every requirement is hidden (Q14).

## Acceptance criteria

- [x] `mode: 'hidden'` behaves exactly like `alwaysOn` in the gate module and the pick counts.
- [x] The trait editor's mode control gains Hidden.
- [x] The setup list and the Traits tab never show a Hidden trait.
- [x] An Enter World category with no visible rows is not shown. This covers categories that hold only Hidden or dormant Always On traits (Q33). The page index may move as picks change.
- [x] Gate lines leave out hidden targets and read "Locked" when none remain.
- [x] Every player-facing surface that names traits leaves out Hidden traits. This covers history, stat change attribution and cascade banners. The ticket's comments list each surface checked.
- [x] AI context, the Prompt viewer and Test Bench still show Hidden traits.
- [x] Tests: absence on the setup list and the Traits tab; the gate-line filter and the bare "Locked"; the trait present in built AI context. Each guard is shown to bite.
- [x] The changelog line is in In Progress.

## Comments

- The gate module already treated `hidden` as Always On (ticket 04, Q31). This ticket adds the editor option and the hiding.
- `RequirementState` gains `hidden`: the target is a Hidden trait, read from the originals first, like the name. A group requirement ("any X") is never hidden, because Hidden is per trait.
- `gateLine` filters Hidden targets by default. The World Editor's trait tree passes `revealHidden`, so the author still sees the full rule.
- Enter World builds the categories twice: all of them for the Begin check, and the ones with a visible row for the navigation. A short group of only unseen traits still holds Begin.
- Surfaces checked:
  - Hides the trait: Enter World rows, category list and `n/m` counts (`EnterWorldWorkspace`, `SetupTraitList`); the Authoring Tour's In Play preview (same `SetupTraitList`); the in-game Traits tab rows, sections, "N active" line and section seed (`traitSections`, `TraitsTab`); gate lines in both; the turn log at game start (`startingTraitLog`, from `GameViewer`) and in play, with the in-play "Turned off" banner (`settleTraits`, `switchPersonaStats`); the Enter World banner (`MainMenu` through `shownRefs`).
  - Keeps the name (author, debug, AI): the World Editor trait tree and its gate tooltip; the Prompt viewer and every AI chip (`buildTraitContext`, `locationContext`); the AI tool snapshot (`toolSnapshot`); Test Bench rules and lens; stat code's trait surface.
  - No trait names found: stat bars and stat rows. They show values with no trait attribution. The player's own switch never names a Hidden trait, because the player can't switch one, stat code can't (Q30), and a max-one swap never retires one.
- Named, not fixed:
  - A max-one group with an active Hidden trait disables its other rows with no visible reason, as Q8 and Q29 rule. The player sees a blocked choice but not its cause.
  - A group whose minimum only unseen traits can meet holds Begin with no page telling the player why. Q9 and Q33 both hold here; `trait-group-defaults-below-min` reports such a world in Test Bench.
  - The Changelog now has four trait-mode entries in In Progress. The changelog hook asks for 2+ entries on one feature to sit under a header. Grouping them touches entries from tickets 01 to 04, so it is left for ticket 07 or the user.
