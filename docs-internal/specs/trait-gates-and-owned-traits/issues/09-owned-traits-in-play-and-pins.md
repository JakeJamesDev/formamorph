# 09: Owned traits in play and pins

Status: ready-for-human
Status note: built in 824ea58c and its review follow-up; notes for later tickets under Comments.
Base: d18020f0
Blocked by: 08 — Enter-world cast pages
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: the pin collector and the Test Bench lens share one walk; adding owners must keep play and the Bench agreeing on who wins.

Parent: [Trait Gates and Owned Traits spec](../spec.md)

## What to build

During play the player switches an NPC's toggleable traits in the Traits tab, and every owner's active traits pin placeholders, with the player's own picks winning a contested one.

## Acceptance criteria

- [x] The in-game Traits tab shows the one tree with entity nodes and lets the player switch toggleable owned traits, through the same gates and cascade.
- [x] The pin collector lays owned traits first, in tree order per owner, then the player's world traits and the played entity's owned traits, later winning.
- [x] The Test Bench lens and the pin-conflict rule read every owner's active traits, and the lens shows the owner of a pin.
- [x] Pin collector and lens tests cover an NPC's owned trait pinning and a player trait winning the same placeholder.
- [x] Verify the changed UI in the live preview with static DOM or frame evidence, both themes, at a realistic viewport.

## Completion checks

- [x] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [x] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
- [x] State every export-shape change in the response.
- [x] Add the In-Progress changelog entry, update the code graph, and complete the shared-code side-effect scan.

## Comments

**Hand-over (2026-09-27).** The runtime settles every owner: `TraitWorld.entityOwners` plus `TraitRuntimeState.ownedTraits` in `src/lib/traitRuntime.ts`, with `switchPlayerTrait` routing an owned trait by id. Pin order lives in `pinTraitsInOrder` (`src/lib/ownedTraitsInPlay.ts`); play, the opening turn, Enter World's `draftPins`, and the lens (`lensPinTraits`) call it. The Traits tab builds from `ownedTraitTree` in GamePanels with `traitEntities`/`traitLibrary` from `useResolvedWorld`.

- **Rulings applied (spec session, Q1–Q5):** the player's set is world traits plus the played entity's owned traits in one-tree order; every world entity that owns traits gets a node, with the user icon and "You"; an NPC's trait reads "Ash's Tamed" in the log and banner; the lens settles owned defaults with persona None; owned pins list in the Pins section and write to the entity.
- **Ticket 11:** `inPlayLibrary` is the play-side library hook; f1854c29 widened it to bind the library persona and the added characters, and MainMenu `draftPins` passes `libraryCast`.
- **Known gaps, not fixed:** the editor's pin rows and conflict note list owned traits before world traits, so a played persona's trait that wins in play reads as losing there (the editor has no persona). The chip field's pin stepping (`PlaceholderField`) still reads world traits only. An entity whose traits are all non-toggleable and unchosen gets no section. Past pages order pins with the live persona, as gates already did. Owned trait names and descriptions are not walked by roll priming (`entityTexts`); ticket 10 holds that as a follow-up.
- **Live preview:** a seeded world on port 5215 showed Grey Wolf under Companions with the user icon, a locked "Requires Paladin" row, the banner "Turned off Grey Wolf's Loyal to Paladins, because of Rogue.", its return on Paladin, log lines with the owner's name, and after a switch to Ash, "Ash You" with Royal Guard unlocked and logged bare. Frames in dark and light at 1440×900; DOM reads for the rest.
