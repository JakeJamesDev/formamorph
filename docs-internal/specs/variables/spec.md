# Spec: Variables

Status: needs-info
Status note: Grill frontier empty; kept open at the user's request for more discussion. Rulings settled with the user on 2026-10-18 and 2026-10-19.

## Problem Statement

An author can store state in two shapes only: a stat (a number with a bar) and a trait (on or off with behavior). Everything else gets squeezed into one of them. A hidden stat stands in for a counter or a variable. A trait with no effects stands in for a flag. A stat-gated trait exists only so a stat band can carry effects. Text, lists and tables have no home at all, so a world cannot remember a child's father, the places a character has visited, or how each character feels about the player.

Stats and traits also grew apart. A trait has requirements, modes, descriptions and a lock on AI changes through its mode; a stat has bands and four AI-change flags, but no requirements and no player or AI description. Two gating systems exist: a trait's requirements, and a trait's stat toggles that switch another stat from outside. A trait's scripts run only while it is on, so a trait cannot turn itself on.

Separately, the AI's stat pass can contradict a World Tool. In Fantasy Futanari the conception Tool rolled "did not conceive", then the stat pass read a "Get pregnant!" line and started a pregnancy anyway.

## Solution

One model, **Variables**, holds every piece of authored state. A variable has a **type**:

| Type | Value | Today's equivalent |
|---|---|---|
| **Trait** | Boolean (on or off) | Trait |
| **Stat** | Number or Percentage | Stat |
| **Text** | One piece of text | none |
| **List** | An ordered list of values | none |
| **Table** | Name → value rows | none |

Every variable shares one set of capabilities where the type allows: owners, groups, Blueprints and Links, requirements, starting value, player and AI descriptions, visibility and editability for the AI and the player, and an Enabled state. Type-specific parts stay with their type: exclusive groups, pick counts and setup picks for Traits; min, max, regen, bands and body sliders for Stats.

The World Editor's list becomes **Variables**. Scripts always read and write every variable, within its requirements.

## Rulings

| # | Ruling |
|---|---|
| Q8 | Scripts get persistent **variables**, saved with the game. They replace any per-call state |
| Q9 | Variables have owner scopes like stats: global, plus per owner |
| Q10 | Variable writes roll back with the turn (regenerate, stop, cancel). A stat re-roll keeps them, as it keeps a Tool's effects |
| Q17 | Values are JSON values, with a size cap per game |
| Q19 | Every variable is declared in the editor |
| Q20 | Variables live in owner panels and Blueprints, like stats, because entities export with their own data |
| Q21 | A write to an undeclared variable is ignored and reported, like an unknown stat |
| Q22 | Variables are typed |
| Q23 | Full tooling parity: rename with Update Code References, hover cards with Find All Uses, Test Bench checks |
| Q24 | Traits and stats are variables. The type names are **Trait**, **Stat**, **Text**, **List** and **Table** |
| Q25 | The editor shows one **Variables** tab |
| Q26 | This effort comes first, because it reshapes the Tool work |
| Q27 | Code keeps a strict split by type: `traits`, `stats`, and `variables` for the rest. A type never changes after creation, so a name never moves between maps |
| Q29 | World and save files hold one `variables` list. `migrateWorld` and the save converter move today's `stats` and `traits` into it. Approved as a shipped-file migration |
| Q30 | Two efforts: this one, then one spec for the Tool lock and multi-timing World Tools |
| Q32 | The code map for stats stays `stats`. The code name for the new map is `variables` in full (`var` is a JavaScript keyword) |
| V1 | Stats gain requirements, player and AI descriptions, and bands keep their role as descriptors. Stats get no setup screen at Enter World |
| V2 | Traits get AI-change protection as one field, not four |
| V3 | **AI** has two settings per variable: Visible or Hidden, and Editable or Read-Only |
| V4 | **Player** has two settings per variable: Visible or Hidden, and Editable or Read-Only |
| V5 | Scripts always see and write every variable. No setting limits them |
| V6 | Every type has a starting value |
| V7 | Traits keep two kinds of player edit: picked at setup (**Starts**) and switched during play (**In Game**). Other types get only the in-play edit for now |
| V8 | A variable with several parts splits its settings where it fits. A Stat's AI Editable splits into increase, decrease, max increase and max decrease, as today's four flags |
| V9 | **Active** is a Trait's on/off value. **Enabled** means the variable is in play |
| V10 | A disabled variable does nothing: its scripts and regen don't run, and it leaves play. Only another script can enable it; it can't enable itself |
| V11 | While a variable is disabled, every script write except `enabled` is ignored. Authors can write to a loop of variables without checking `enabled` first |
| V12 | Enabled is a three-way choice: **On**, **Off** or **Automatic**. Automatic means its requirements decide, and no one (AI, player or script) overrides it. With no requirements, Automatic is always on |
| V13 | The UI never offers Hidden together with Editable for the same audience |
| V14 | A Trait's scripts run whenever it is enabled, active or not, so a trait can activate itself. No migration: no shipped world relies on the old rule |
| V15 | A Trait's effects and what the AI reads follow Active. An inactive trait sends nothing and its stat changes don't apply |
| Q31 | The player's in-game panel is named **Info** |
| Q33 | In this effort only Stats can be AI Editable. V2 (a Trait's single AI field) waits for the effort that lets the AI switch traits; until then AI Editable shows only on Stats |
| Q34 | Info draws each type its own way: Stat as a bar or number, Trait as today, Text as one line, List as bullets, Table as name → value rows |
| Q36 | Optional and Automatic stay Trait-only player-choice modes. Hidden folds into Player Visible on every type; Automatic becomes Enabled Automatic; Optional becomes Player Editable on a Trait |
| Q37 | Requirements on the gated variable replace a trait's stat toggles. The migration turns each toggle into a requirement on the toggled variable; a turn-off toggle becomes a **Not** condition |
| Q38 | A Stat's bands carry effects while active: max, min and regen changes, plus the placeholder pins bands already have |
| Q39 | Requirements gate Enabled. Active is a Trait's value inside that. In Heat is Automatic with Starts Active; a Race trait is Enabled On and the player picks which is Active |
| Q40 | The glossary's single-value Placeholder term changes from Variable to **Single Value** |
| Q41 | An AI Visible Text, List or Table reads as one line in its owner's block, beside stats and traits. Probed before it ships |
| Q42 | In this effort only Traits (Starts and In Game) and Text are Player Editable. List and Table editing on Info waits for its own design |
| Q43 | Info replaces today's in-game stat panel and trait list as one panel, grouped as the author grouped the variables |
| Q44 | Placeholders fold into this spec |
| Q45 | A Placeholder is a **Text** variable (Wildcard) or a **List** variable (Object) with a weighted **Pool** and the **Chip** switch on. It keeps the name Placeholder and every current feature. **Unique scope** stays a Placeholder-only option: each chip placement rolls its own value, so it has no single value |
| Q46 | Pins generalize to every variable: a variable has a base value, and any pin source (a trait, a band, a location, a value) can pin any variable while the source is active |
| Q47 | A disabled placeholder's chip renders nothing |
| Q49 | Any Text or List variable can draw its starting value from a weighted Pool, chip or not |
| Q50 | Pin ranking stays: band > location > trait > value. Script and AI writes always land on the base, which shows again when every pin ends |
| Q51 | A pinned Stat's base keeps moving under the pin: regen, AI and script changes apply to the base |
| Q52 | A pin can set a Trait's Active value, never its Enabled state. Requirements alone decide Enabled |
| Q55 | Every Text and List lives in `variables` in code. `placeholders` stays as the shipped name for chip ones, so flipping the Chip switch never moves a name |
| Q56 | One **Variables** tab with nested **Traits**, **Stats**, **Text**, **Lists** and **Tables** tabs, on the world and on every entity. Replaces Q25's flat tab. The Placeholders tab retires; chip variables show under Text and Lists with a Chip column, and a placeholder's Values and Pins sub-tabs move into its panel |
| Q58 | The generalized hold keeps the name **Pin** |
| Q60 | Only Text and List have the Chip switch in this effort |
| D1 | Implementation choices: the cap is 64 KB of variable data per game; code reads and writes `.value` and `.enabled` on each entry |

## User Stories

1. As an author, I want one Variables tab, so that every piece of state in my world lives in one place.
2. As an author, I want to pick a type when I add a variable, so that the editor shows only the settings that type needs.
3. As an author, I want a Text variable, so that my world can remember a single fact such as a child's father's name.
4. As an author, I want a List variable, so that my world can remember the places a character has visited.
5. As an author, I want a Table variable, so that my world can keep a value per name, such as trust per character.
6. As an author, I want my existing stats and traits to open as Stat and Trait variables, so that I lose nothing when I update.
7. As an author, I want every variable to have a starting value, so that a new game starts in a known state.
8. As an author, I want to give an entity its own variables, so that its data travels with it when I export it.
9. As an author, I want Blueprint variables that entities link, so that I define one variable once and give it to many entities.
10. As an author, I want a link to override a Blueprint variable's starting value, so that each entity can start differently.
11. As an author, I want to group variables, so that a long list stays readable.
12. As an author, I want to choose whether the AI sees a variable, so that I can keep author-only data out of the prompt.
13. As an author, I want to choose whether the AI can change a variable, so that the AI can't move state my scripts own.
14. As an author, I want to choose whether the player sees a variable, so that I can keep secrets such as The Weave hidden.
15. As an author, I want to choose whether the player can change a variable during play, so that a player can edit their own notes but not their stats.
16. As an author, I want a Stat's AI changes split into increase, decrease, max increase and max decrease, so that the AI can raise Depravity but never lower it.
17. As an author, I want a Trait's AI changes to be one setting, so that I don't set four flags that mean nothing for on/off.
18. As an author, I want requirements on any variable, so that Virility exists only while the character is futanari.
19. As an author, I want requirements to live on the gated variable, so that I read why something is off where it is, not on some other trait.
20. As an author, I want Enabled to be On, Off or Automatic, so that I can choose who decides whether a variable is in play.
21. As an author, I want an Automatic variable to follow its requirements and nothing else, so that no script or AI can force it.
22. As an author, I want a disabled variable to run no scripts and no regen, so that switching it off removes it from play completely.
23. As an author, I want writes to a disabled variable to be ignored, so that I can loop over variables without checking each one first.
24. As an author, I want a script to be able to enable a disabled variable, so that one system can bring another into play.
25. As an author, I want a Trait's scripts to run while it is inactive, so that a trait can switch itself on.
26. As an author, I want an inactive trait to send nothing to the AI and apply no effects, so that being off still means off.
27. As an author, I want Stats to have player and AI descriptions, so that I can explain a stat to each audience the way I explain a trait.
28. As an author, I want the editor to refuse Hidden plus Editable for the same audience, so that I can't make a setting nobody can use.
29. As an author, I want `stats.X` and `traits.X` to keep working in my scripts, so that my shipped worlds run unchanged.
30. As an author, I want Text, List and Table variables under `variables.X` in code, so that the name never clashes with stats or traits.
31. As an author, I want a write to an undeclared variable underlined and reported, so that I catch typos.
32. As an author, I want a write of the wrong type reported, so that a List never ends up holding a number.
33. As an author, I want renaming a variable to offer Update Code References, so that my scripts follow the rename.
34. As an author, I want hover cards and Find All Uses on variables, so that I can see where each one is read and written.
35. As an author, I want the Test Bench to flag variables nothing reads or nothing writes, so that I clean up dead state.
36. As an author, I want Test Code to list variable reads and writes, so that I can check a script before I play.
37. As a player, I want the variables the author shows me on my panel, so that I can see my character's state at a glance.
38. As a player, I want a regenerated turn to undo that turn's variable changes, so that state never comes from a story that didn't happen.
39. As a player, I want variables saved with my game, so that a loaded save remembers everything.
40. As a player, I want a world built on today's stats and traits to play exactly as before, so that updating the app breaks nothing.

## Implementation Decisions

### Model

- One authored `variables` list replaces the world's `stats` and `traits` lists, and the same on entities and in Blueprints. Each entry carries its `type` and the fields that type uses.
- Shared fields: id, name, type, group, owner placement, starting value, player description, AI description, requirements, Enabled (On / Off / Automatic), AI Visible, AI Editable, Player Visible, Player Editable.
- Trait-only fields: exclusive groups, pick counts, Starts, In Game, effects (stat changes, placeholder pins).
- Stat-only fields: number or percentage, min, max, regen and its unit, bands, threshold unit, body sliders, and the four AI-change directions.
- Text, List and Table hold a typed JSON value under the per-game size cap.
- Today's trait Mode and the stat hidden flag fold into the new settings: Hidden becomes Player Visible off. Automatic becomes Enabled Automatic.

### Runtime

- Enabled gates everything. A disabled variable runs no scripts and no regen, sends nothing to the AI, shows nothing to the player, and ignores every script write except `enabled`.
- A Trait's Active value decides its effects and what the AI reads. Its scripts run whenever it is enabled.
- An Automatic variable is enabled exactly while its requirements hold. No AI change, player edit or script write overrides it.
- AI changes pass through AI Editable (and a Stat's four directions) on every AI path: the JSON stat pass and the text-line fallback.
- Player edits pass through Player Editable.
- Variable writes join the turn's writes, so a regenerate, stop or cancel undoes them and a stat re-roll keeps them.

### Code surface

- `stats` and `traits` keep their meaning. `variables` holds Text, List and Table. Owner routes (`owner`, `persona`, `entities.X`) gain `variables` the same way they hold `stats` and `traits`.
- Writes to an undeclared name, or of the wrong type, are ignored and reported.

### Files and migration

- `migrateWorld` moves `stats` and `traits` into `variables`, idempotently, at every import boundary. Entity, Blueprint, character card and library files follow.
- The save envelope gains variable values and migrates its stat and trait state into the same shape.
- A trait's stat toggles become requirements on the toggled stat. A toggle that turns a stat off becomes a **Not** condition (Q37).
- Export-shape change on world, card and save files.

### Placeholders and pins

- A Placeholder is a Text or List variable with a Pool and Chip on (Q45). Placeholders move into the `variables` list in files, with their values, weights, scope and pins.
- Every variable holds a base value plus pins (Q46). The shown value is the highest-ranked active pin, else the base. Writes always change the base (Q50, Q51).
- Pin sources keep their homes: a trait's pins, a band's pins, a location's pins and value pins. Their target can now be any variable.

### Editor

- The Stats, Traits and Placeholders tabs become one **Variables** tab with nested type tabs (Q56), with the owner tree, groups and Blueprints the Stats tab has today. The add menu offers each type. Each type's panel shows only its fields.

## Testing Decisions

- Tests check behavior at the highest seams that already exist, never internal helpers:
  - **Migration seam:** `migrateWorld` and the save converter. Old world and save fixtures in, the unified shape out; idempotent on a second pass; every shipped bundled world plays its first turn the same before and after (the parity suite against history is prior art).
  - **Turn seam:** the turn pipeline's commit (ADR 0001) and the script turn runner. Enabled gating, Automatic, ignored writes on disabled variables, AI Editable and the four directions, rollback on regenerate.
  - **Rule seam:** the Test Bench's `runRules`. Unused and never-written variables, unknown names, wrong-type writes.
- Each guard is proven by reinstating the bug it prevents (`test-bar`).
- Prior art: the trait runtime's entity-stat tests, the stat request tests, the Test Bench rule tests, and `migrateWorld` tests.
- The three seams were confirmed with the user on 2026-10-19. No new seams.

## Out of Scope

- The Tool lock and multi-timing World Tools. Settled points for that spec are recorded below.
- Chips on Stat, Trait and Table variables (Q60).
- AI edits to any type but Stat, including the AI switching traits (Q33).
- Player editing of List and Table on Info (Q42).

## Open Questions

None from the grill so far; the user is keeping the spec open for more discussion. The probe plan for Q41 is set when its ticket is written.

## Settled for the Tool spec

| # | Ruling |
|---|---|
| Q2 | The AI-change lock lives on the World Tool, as a list of the stats it decides |
| Q3 | The lock reuses a Stat's four directions |
| Q4 (amended) | The lock applies whenever the Tool would be sent that turn, called or not: the Tools switch is on, the Tool is offered to a prompt, and that prompt's endpoint takes Tools. Without that, the AI changes the stat as usual. Reason: in testing the AI changed the stat on turns the Tool would have handled |
| Q5 | A fully locked stat leaves the stat pass's reply schema and keeps its reading |
| Q6 | The lock covers every AI path, never scripts, traits or regen |
| Q7 | A multi-timing World Tool holds at most one script per timing; each call arms all of them |
| Q12 | The lock covers every owner's copy of a Blueprint stat |
| Q13 | The stat prompt gets no line saying a stat is locked |
| Q14 | The AI reads On Call's return when the Tool has an On Call script; the Reply field shows only for a Tool without one |
| Q15 | Stack Calls keeps today's rule in every timing |
| Q16 | `migrateWorld` moves single-timing Tools into the new shape. Approved as a shipped-file migration |
| — | Offering a Tool to Stat Updates doesn't work on servers that enforce the reply schema: the model plans the call but can only write JSON. Seen on LM Studio with MeroMero on 2026-10-18 |

## Further Notes

- Origin: the Fantasy Futanari 3.3.2 pass (`worlds-wip/`), where `roll_conception` worked but the stat pass overrode its roll.
- This effort fulfills the 2026-08-05 direction for author-defined per-entity runtime fields (`docs-internal/notes/world-authoring-feature/notes.md` §1), which replaced the removed list stat.
- City Rampage's Berserk State switch script resets Berserk on any trait switching on, not only its own. Unaffected by V14; fix in a bundled-world pass.
