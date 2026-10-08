# Trait Gate Rows and the Availability Rule

Status: ready-for-agent
Spec session: trait-gate-rows — spec

## Problem Statement

A trait's Requires field is a flat list. The trait opens when any one entry holds. That is OR, and nothing else. An author cannot say:

- "Plate Armor needs Knight **and** Heavy Build." Two requirements open it for either one.
- "Street Smarts only when **not** Paladin." There is no way to lock a trait because of something the player has.
- "Knight and not Paladin, **or** Mercenary." Mixing the two is impossible.

Authors work around it with descriptions the player may not read, or with Pick Counts that only limit a group.

The Availability tab itself reads as a pile. A Mode switcher with a hint, two checkboxes that vanish when Mode is Always On, then the Requires chips. Three separate questions share one surface with no visible order, and a field that disappears looks like a bug.

## Solution

- **Requirement Rows.** A trait's gate is a list of rows. A row holds when every Condition in it holds. The trait is available when any one row holds, or when it has no rows. This is "and" inside a row, "or" between rows.
- **Not.** Any Condition can be flipped to Not. A Not Condition holds while its target is off. "Not Paladin", "not any Class", "not playing as Sir Aldric".
- **The rule layout.** The top of the Availability tab reads as three short rows: **Mode** (Optional / Automatic / Hidden), **Starts** (Off / On), **In Game** (Fixed / Toggleable), then one sentence that states the rule they make. Starts and In Game stay visible under Automatic and Hidden, disabled, so nothing jumps. Automatic is the new name of the Always On mode.
- **The player reads the same rule.** "Requires Knight and not Paladin, or Mercenary." Test Bench catches the new traps: a Not cycle that can never settle, and a row that can never hold.

The prototype that settled the shape is `prototype.html` beside this spec (variant A rows, rule top). Open it from the `scratch-trait-availability` launch entry or by double-click.

## User Stories

### Authoring rows

1. As an author, I want a requirement row to hold several Conditions, so that "Knight and Heavy Build" opens one trait.
2. As an author, I want several rows on one trait, so that "Knight and Heavy Build, or Mercenary" is one gate.
3. As an author, I want a trait with no rows to be always available, so that nothing changes for ungated traits.
4. As an author, I want a Condition flipped to Not with one click on its chip, so that "not Paladin" costs no extra picker trip.
5. As an author, I want a Not Condition to look different from a plain one, so that I never misread the rule.
6. As an author, I want Not on a group Condition to mean "no trait in the group is active", so that "not any Class" works.
7. As an author, I want Not on a playing-as Condition, so that a trait exists for every persona but one.
8. As an author, I want Not on a Condition with a bearer, so that "Ash: not Tamed" gates on the wolf being wild.
9. As an author, I want the first add to read **Add Requirement** and later adds to offer **And** inside a row or **Or Another Way** below, so that the two joins stay distinct.
10. As an author, I want a row with one chip to remove itself when I remove the chip, so that no empty row lingers.
11. As an author, I want to remove a whole row at once, so that dropping one alternative is one click.
12. As an author, I want the picker to skip the bearer page when only one bearer can hold the target, so that a plain world trait is one click to add.
13. As an author, I want the picker to still ask for the bearer when more than one could hold the target, so that "You: Tamed" and "Ash: Tamed" stay distinct.
14. As an author, I want a chip to open its target when clicked, so that I can follow a chain, as today.
15. As an author, I want a chip whose target is gone to read red under its stored name, so that I notice broken gates.
16. As an author, I want the tree row's lock summary and tooltip to read the full rule, so that I can scan gates without opening each trait.
17. As an author, I want my existing requirements to open as one-chip rows, so that every shipped world reads exactly as before.
18. As an author, I want a linked trait to override its rows as one field with a **Reset**, so that links work as they do for every other field.
19. As an author, I want a character card to carry rows and Not, so that an exported entity keeps its gates.

### The rule layout

20. As an author, I want Mode, Starts and In Game as three labeled rows, so that I see the three questions at once.
21. As an author, I want Starts and In Game disabled under Automatic and Hidden rather than gone, so that the panel never jumps.
22. As an author, I want one sentence under the rows that states what they mean together, so that I can check the rule in plain words.
23. As an author, I want each row to keep its per-field **Reset** on a linked trait, so that link overrides work as today.
24. As an author, I want the three rows to answer the same stored fields as before, so that no world changes because of the layout.

### Rules that hold in play

25. As a player, I want a locked trait to read "Requires Knight and not Paladin, or Mercenary", so that I know how to open it.
26. As a player, I want an open trait to read which row opened it, so that I see why it is available.
27. As a player, I want a trait to lock the moment I pick something it excludes, so that the screen answers my choice.
28. As a player, I want an active trait to turn off when I pick something it excludes, with the banner that names it, so that the rules always hold.
29. As a player, I want a trait that turned off because of an exclusion to return when I drop the excluding pick, so that a wrong click is undone by its reverse.
30. As a player, I want my earlier pick to win when two picks exclude each other, so that a new pick never silently removes an old one without the banner.
31. As a player, I want an Automatic trait with a Not Condition to turn on and off as the excluded trait moves, so that "Automatic unless Paladin" works.
32. As a player, I want a Not Condition on a Hidden trait left out of the lock line, so that the secret stays secret.
33. As a player, I want a default trait excluded by another default to start unselected, so that the defaults never break a gate.
34. As a player, I want a save to settle its traits against the new rules on load, so that an edited world never leaves an impossible set active.

### Test Bench

35. As an author, I want Test Bench to report a cycle that passes through a Not as an error, so that no trait can flip forever.
36. As an author, I want Test Bench to report a row that can never hold, such as "Paladin and not Paladin", so that I fix a dead alternative.
37. As an author, I want Test Bench to report a trait no selection can ever open, with rows and Not counted, so that the existing rule stays true.
38. As an author, I want Test Bench to report two defaults that exclude each other, so that I learn why one does not start selected.
39. As an author, I want Test Bench to report a Condition that points at nothing, per Condition, so that a broken chip inside a row is found.

## Implementation Decisions

**Rulings (discussion and prototype, 2026-10-07).** A settled ruling reopens on new evidence, not on a new opinion.

| # | Ruling |
| --- | --- |
| Q1 | The gate model is rows of Conditions. "And" inside a row, "or" between rows, Not per Condition. No nested tree, no separate Excludes list. The prototype compared all three. |
| Q2 | The Availability tab's top is three rows, Mode / Starts / In Game, plus one summary sentence. Picked from the prototype's rule top. |
| Q3 | The Mode row reads Optional / Automatic / Hidden. Automatic replaces Always On as the mode's name everywhere: glossary, `CONTEXT.md`, wiki, editor copy and Test Bench messages. The stored value `alwaysOn` does not change. The row label stays Mode; the summary sentence carries the meaning, so the label matters less. Supersedes trait-modes Q18. |
| Q4 | Under Automatic and Hidden, Starts and In Game are disabled, not hidden. The stored fields are still ignored, so trait-modes Q13 holds: no invalid mix is possible. |
| Q5 | A Condition is today's requirement plus an optional `not` flag. The target kinds stay: trait, group, playing as, each with the bearer rules it has now. |
| Q6 | A trait with no rows is always available. A row with no Conditions cannot exist: removing the last chip removes the row. |
| Q7 | `settle` keeps its least fixpoint for positive growth, then checks every kept trait against the final set and turns off any whose gate fails because a Not target joined. It repeats until nothing changes. Each outer pass shrinks the proposal, so it ends. |
| Q8 | When two kept traits exclude each other, the one proposed later turns off. The player's earlier pick wins, and the banner names the later one. |
| Q9 | A trait turned off by an exclusion goes to the cascade-off list and returns through it, like a trait turned off by a failed positive Condition. |
| Q10 | An Automatic trait with a Not Condition follows its gate both ways. It is never on the cascade-off list; its mode brings it back. |
| Q11 | The player line reads rows joined by "or" and Conditions joined by "and". A Not Condition reads "not X"; with a bearer, "Ash: not Tamed" and "You: not Paladin". |
| Q12 | A Not Condition whose target is Hidden is left out of the player line like a positive one (trait-modes Q14). A row whose Conditions are all left out is dropped from the line. No rows left reads "Locked". |
| Q13 | Test Bench gains `trait-requirement-unstable` (error): a cycle in the requirement graph with at least one Not edge. A cycle with no Not edge stays `never-unlockable`. Refined by Q32: only an odd Not count fires. |
| Q14 | Test Bench gains `trait-requirement-row-never-holds` (warning): a row names a target both plain and Not, or names a trait plain and its group Not under the same bearer. |
| Q15 | `trait-requirement-never-unlockable` treats every Not Condition as holding. It is an optimistic check and may under-report; that is accepted. |
| Q16 | `trait-default-gated` covers two defaults that exclude each other: `settleDefaults` turns the later one off, and the rule reports it like any default that does not start selected. |
| Q17 | `requires` changes shape on world traits, entity-owned traits and link overrides. `migrateWorld` wraps each flat entry in its own row. Idempotent. Rows are shipped export shape, so the migration lives in the net, not in dead compat. |
| Q18 | The character card codec reads both the flat list and rows, and writes rows. A card is shipped shape too. |
| Q19 | Saves do not change. Active ids and cascade-off lists keep their shape. A save load settles against the new rules (trait-modes Q34). |
| Q20 | The picker skips the bearer page when exactly one bearer can hold the target, and adds for that bearer. It asks when two or more can. |
| Q21 | The "Available when any one of these holds" hint is removed. The rows show the rule. |
| Q22 | Rows are the whole override field on a link, as `requires` is today. Reset puts back the original's rows. |
| Q23 | At the persona boundary, a Condition that names the played entity as bearer can never hold: the relationship cannot apply to yourself. The whole row that holds it is dropped as closed. A trait with every row dropped is not offered, as today. A trait with no rows to begin with is unaffected. (Refined 2026-10-07 on ticket 02's question; the earlier text read as dropping the Condition alone.) |
| Q24 | **In Game** is the one term for "after the game has started". Label form In Game; adjective form in-game, hyphenated only before a noun; prose "in game" or "during the game". In Play, In-Game and during play are retired everywhere, including the Authoring Tour pane and the Entities wiki page. Ticket 01 is the sweep. |
| Q25 | "In the game" and "in the scene" are two terms and never swap. In the game is the whole playthrough, every turn from Enter World on; the stat-code roster strings and the "owners not in the game" warnings mean this. In the scene is a selection of narration turns at a location; entity presence is its own system. `CONTEXT.md` gains a **Scene** entry. Ticket 06 checks the Traits and StatCodeGuide pages against both. |
| Q26 | A trait's own activity never counts toward its own gate, in either polarity. "Scout" in group Class with "not any Class" does not turn itself off, and a gate line never reads "Unlocked by any Class" from the trait itself. |
| Q27 | An unresolved Condition never holds, plain or Not, so its row fails. A deleted target leaves dependents locked, never open (trait-gates story 17). |
| Q28 | Settle order (Q7, Q8 made concrete): positive growth treats every Not Condition as holding; then a check against the final set turns off the latest-proposed failing trait, one per pass, and the pass reruns. Proposal order is the active list (pick order), then Automatic traits, then cascade-off returners. |
| Q29 | Settle is idempotent. After the drop loop, each dropped trait is tried again in proposal order and kept when the whole set still checks clean. A, B, C with A "not B", B "not A", C "not B" settles to {A, C} in one call, and a second settle changes nothing. |
| Q30 | A cascade-off returner never turns off a pick or an Automatic trait. When its return would make any kept trait fail, it stays on cascade-off. The player's deliberate state wins over an automatic return. A pick that excludes an active Automatic trait stays locked, because the Automatic trait's gate holds (Q10). |
| Q31 | The exclusive-sibling skip in a Condition applies only inside the trait's own owner. "You: not Paladin" on an entity's linked trait reads the player's Paladin even when the entity's own group also holds a Paladin. (Correctness fix found by ticket 03.) |
| Q32 | `trait-requirement-unstable` fires only on a cycle with an odd number of Not edges. An even count, such as mutual exclusion "A: not B" and "B: not A", is a supported pattern that settles to the earlier pick (Q8, Q29) and never flips. Refines Q13 on ticket 04's evidence. |
| Q33 | `trait-requirement-unresolved` reports one finding per dead Condition. A one-Condition row keeps today's text; a longer row names the row that never holds. A dead Condition that only a link override adds is reported on that link, with the bearer named, and opens the link. A world trait's dead Condition is reported once, not per linked copy. |
| Q34 | In `trait-requirement-row-never-holds`, "its group" means any group above the trait in that bearer's tree, not only the direct one. On a linked trait the finding names the entity and opens the link. |
| Q35 | Test Bench messages that print a gate use the gate line's form: Conditions quoted and joined by "and" inside a row, rows joined by "or". The default-gated message keeps its sentence; a Not cause reads inside it, such as "meets “not A”". No separate "excluded by" sentence. |

**Schema (world export shape).**

- `TraitRequirement` gains `not?: true`. Absent means plain.
- `Trait.requires` becomes `TraitRequirementRow[]`, where a row is `{ all: TraitRequirement[] }`. Absent or empty means always available. `TraitLinkFields.requires` follows.
- `migrateWorld` rewrites a `requires` whose entries carry `kind` into one row per entry. Entries that carry `all` are left alone. It runs on world traits, entity-owned traits, and link overrides.
- The character card XMP codec accepts both forms on read and emits rows.
- Library entities never pass through `migrateWorld`, so the single library read wraps flat lists into rows too. A 3.2.x library character with gated owned traits would otherwise break the adopt and link paths. (Found by ticket 02.)

The shape, from the prototype:

```ts
type TraitRequirement =
  | { kind: 'trait'; id: string; name?: string; bearer?: RequirementBearer; not?: true }
  | { kind: 'group'; id: string; name?: string; bearer?: RequirementBearer; not?: true }
  | { kind: 'playingAs'; id: string; name?: string; not?: true };
type TraitRequirementRow = { all: TraitRequirement[] };
// Trait.requires?: TraitRequirementRow[]
```

**Gate module.**

- One Condition holds as today, then flips under `not`. An exclusive sibling of the trait still never counts as active for a plain Condition. For a Not Condition the sibling counts as off.
- A row holds when every Condition holds. A gate holds when it has no rows or some row holds.
- `GateState.requirements` becomes per-row state: each row carries its Conditions' text, holds, unresolved and hidden flags, and the row's own holds.
- `settle` follows Q7 to Q10. `switchTrait` needs no new refusal: switching on a trait that excludes an active one is allowed and cascades the other off with the banner.
- `settleDefaults` follows Q16.
- The text builder for the player line and the tree summary follows Q11 and Q12.
- `sameRequirement` compares the `not` flag too, so a row can hold "Paladin" and "not Paladin" only as a row-never-holds finding, never as a duplicate chip.

**Editor.**

- The Requires field renders rows. Each row is a bordered line of chips joined by "and", with an **And** add button and a row remove control. Rows are separated by a dim "or". Below the rows, **Or Another Way** adds a row; with no rows the button reads **Add Requirement**.
- A chip carries a Not flip control. A Not chip shows a NOT mark and a dashed border. The flip's tooltip reads "Require it to be off" or "Require it instead".
- The picker is the existing breadcrumb picker with the Q20 bearer-page skip.
- The Availability tab top follows Q2 to Q4. The summary sentence varies with the values: for Optional it names the start state and whether the player can switch it; for Automatic and Hidden it states the mode's rule.
- Link overrides: Mode, Starts, In Game and Requires each keep a per-field **Reset**.

**Test Bench (`runRules`).** Per bearer through the existing lens.

- New: `trait-requirement-unstable` (error, Q13), `trait-requirement-row-never-holds` (warning, Q14).
- Changed: `trait-requirement-never-unlockable` (Q15), `trait-requirement-unresolved` reports per Condition, `trait-default-gated` (Q16). The existing cycle finder gains edge polarity.

**Docs and copy.**

- World Editor: Traits wiki page: the Requirements section describes rows, And, Or Another Way, and Not. The Glossary's Requirement row gains Condition and Not.
- `CONTEXT.md` gains **Requirement Row** and **Condition**, with Not as a flag on a Condition. Avoid: exclusion, negation, rule (a rule is Test Bench's word).
- **In Game** replaces In Play, In-Game and during play across copy, wiki and glossary (Q24). The sweep is its own ticket and runs first; the editor's new rows use the term from the start.
- **Always On** becomes **Automatic** (Q3) in `CONTEXT.md`, the Glossary, the World Editor: Traits page, editor copy, Test Bench rule messages and the help docs. Released changelog entries keep their text. Code identifiers such as `alwaysOn` and `isAlwaysOn` are not renamed.
- Changelog: one entry under In Progress, Added, 👤.

## Testing Decisions

Tests exercise behavior through public seams and never mirror the implementation. Each new refusal, text form and rule gets a guard, and each guard is proved to bite by reinstating its bug (`test-bar` skill). All seams exist today.

- **Gate module** (`gateStates`, `settle`, `switchTrait`, `settleDefaults`): the main seam.
  - And inside a row, or between rows, Not on trait, group, playing-as and bearer Conditions.
  - Exclusion cascade with the banner report, return through cascade-off, earlier pick wins (Q8), Automatic unless X (Q10).
  - Defaults that exclude each other (Q16). A trait with no rows.
  - Prior art: the existing gate module tests.
- **Gate line text:** every Q11 and Q12 form, including hidden-dropped rows and "Locked". Prior art: the existing gate line tests.
- **Test Bench `runRules`:** both new rules, the three changed rules, per bearer, with a linked trait. Prior art: the existing requirement rule tests.
- **`migrateWorld`:** flat entries become one-chip rows on world traits, owned traits and link overrides; twice gives the same result; rows pass through untouched. Prior art: the exclusive-groups migration tests.
- **Character card codec:** a card with rows and Not round-trips; a card with the flat list imports as rows. Prior art: the existing entity file tests.
- **Component tests** on the Requires field and the trait panel, for structure and copy only: rows render with "and" and "or"; the add buttons read per Q6 and the field decisions; the Not flip changes the chip and the stored flag; the bearer page is skipped for a single bearer and shown for two; Starts and In Game are disabled under Automatic and the summary sentence changes. Prior art: the existing Requires field and trait panel tests.

## Backlog

- An AI prompt line in the experimental prompts still says "changes during play". Ticket 01 left it alone because a prompt change needs probe numbers. Sweep it with the next prompt probe.
- The Semantic search vectors for help sections are rebuilt at release, so the renamed Entities section drops out of Semantic search until then (ticket 01).
- The `slots` segmented-control pattern has one user, the Availability tab. A Design System line was proposed, not applied; it waits on the user and a second surface.

## Out of Scope

- Nested groups of rows (a tree). Rows and Not cover every boolean rule; a rare formula costs more rows.
- Conditions on stats, time, location, or Pick Counts.
- Not on a whole row or on a whole gate.
- A player-facing "why is this locked" beyond the lock line.
- Renaming the stored `alwaysOn` value or code identifiers (Q3).
- An end-to-end Playwright pass.

## Further Notes

- ⚠️ **Export shape:** `requires` changes from a flat list to rows and gains `not`. Requirements shipped in 3.2.x, so `migrateWorld` and the card codec carry the old form forward. Saves are untouched.
- The prototype's picker skipped the bearer page for every target and rendered a plain list. Both were shortcuts; Q20 and the existing breadcrumb picker are the real behavior.
- The discussion that led here found that `settle` relies on every gate being monotone. Q7 is the smallest change that keeps the least fixpoint for the common case and adds a bounded fix-up pass for Not.
