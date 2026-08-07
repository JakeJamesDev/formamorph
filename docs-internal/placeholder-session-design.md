# Placeholder Session — Design Memo

Follow-on to `placeholder-names-design.md`. Moves placeholder rolls out of `GameplayContext` into a
**world session** that begins when the player enters a world, so the pre-game picker screens show real
rolled values instead of `{red|brown|black}`. Agreed 2026-08-07.

## The problem

Two things got fused that aren't the same thing:

- **the roll** — which value a Wildcard took for this playthrough
- **the pin** — an active trait forcing a placeholder to a fixed value

Because a pin was treated as something that could *invalidate* a roll, the only defense was to roll
**late** — after the pickers, at `isGameStarted`. That is why `TraitSelectionModal` renders
`{red|brown|black}` rather than a value, and why the starting-location picker offers
`{Sedge|Marrow} Square` *and* `{Sedge|Marrow} Docks` — two places that read as unrelated rather than
as one town.

The conflict is imaginary. `resolvePlaceholders` already takes `{ rolls, pins }` and layers pins **on
top** at resolve time; the roll underneath is never overwritten. So a screen can show a rolled value
and have it update live as traits are picked. Rolling early was only unsafe under the assumption that
pins mutate rolls, which they don't.

## What moves

**Only the rolls.** `GameplayProvider` still mounts per game — playerStats, turns, memory and the rest
keep their fresh-mount clean slate. This is deliberately not the "hoist the provider" version.

### New: `PlaceholderSessionProvider`

Sits between `GameDataProvider` and the view switch in `src/App.tsx`, owning three things:

| Owns | Was |
|---|---|
| `placeholderRolls` + `setPlaceholderRolls` | `GameplayContext.tsx` state |
| `beginSession(initialRolls?)` / `endSession()` | implicit in `GameplayProvider` mount/unmount |
| the eager **priming effect** | the `isGameStarted`-gated effect in `GameViewer.tsx` |

The priming effect moves wholesale. It sits under `GameDataProvider` so it reads the same authored
texts; its gate changes from `isGameStarted` to `sessionActive`. GameViewer's copy is deleted and its
`raw*` destructure goes with it — **GameViewer stops calling `useGameData()` entirely**, which finally
makes the "read the world through `useResolvedWorld()`" invariant total rather than aspirational.

`GameplayContext` keeps exposing `placeholderRolls` / `setPlaceholderRolls`, delegating to the session.
Every existing consumer — the save envelope write, the save-restore write, `usePlaceholderResolver` —
compiles and behaves unchanged.

### Lifecycle — one choke point per path

Explicit lifecycle replaces what mount/unmount gave for free. Every entry and exit is enumerated:

| Path | Site | Action |
|---|---|---|
| Enter World | the Enter World button, `MainMenu.tsx` | `beginSession()` before the first step opens |
| Quick Start | the Quick Start button, `MainMenu.tsx` | `beginSession()` — it calls `onStartGame` directly |
| Load save | `handleLoadSaveGame`, `App.tsx` | `beginSession()` — empty; the save's rolls follow from the restore |
| Exit to menu | `handleExitToMenu`, `App.tsx` | `endSession()` |
| Abandon the flow | closing / backing out of the first step | `endSession()` |
| Back *within* the flow | `backFrom`, `MainMenu.tsx` | **nothing** — rolls are sticky inside one flow |

A watcher that ended the session on a world change was designed and then **dropped**: cold-load calls
`loadWorldData` and `beginSession` in one batch, so the effect would fire *after* the seed and wipe the save
it had just resumed. The exits above already cover every reachable path out of a world.

**A loaded save never re-rolls.** `primeRolls` preserves existing rolls by contract, so whatever the restore
writes is authoritative — whether it arrives with the session (seeded) or a beat later (cold load). Hazard 1
covers the second case, which is the one that actually happens.

**Abandon-and-re-enter re-rolls** — mirrors today's behavior one screen earlier. Stepping back and
forth *within* one flow does not reshuffle, so reading the trait list twice is free.

### Hook split

`useResolvedWorld` needs three things from `useGameplay()`: rolls, gameplay-side collections, and trait
pins. Split so the first is available without the other two:

- **`useResolvedAuthoredWorld(pins?)`** *(new)* — `useGameData()` + the session's rolls. Returns the
  authored collections resolved, plus `resolvePH`. Works anywhere under the session provider, MainMenu
  included.
- **`useResolvedWorld()`** — becomes a thin composition: `useResolvedAuthoredWorld(traitPins)` plus the
  gameplay-side resolutions (`playerStats`, `viewStats`, `runtimeDictionary`). **Signature and return
  type unchanged**; GameViewer and GamePanels are untouched.

`resolveWorldNames.ts` and its reference-identity contract are unchanged — this is re-plumbing above
the mappers, not through them.

### Pins at resolve time

`MainMenu` computes `draftPins` from the same `activePlaceholderPins(inAuthoredOrder(…))` derivation
`useResolvedWorld` runs — fed the checkbox state instead of the committed save — and passes
`useResolvedAuthoredWorld(draftPins)` to every step. Checking *Redhead* flips every hair-color value on
screen live; unchecking brings the roll back, because pins mask and never overwrite.

The pickers take a **`resolveText` prop** rather than the placeholder defs. Names arrive already resolved
through the collections; descriptions are resolved by the prop, since the mappers only touch names. Making
it required rather than defaulted means a new step cannot silently skip resolution.

`describePlaceholders` retreats to surfaces with **no session**: library card titles, community
listings, the world-details panel, export filenames. Display-matrix row four gets narrower; no other
row moves.

## Hazards, and what closes each

1. **Priming racing a cold-load restore.** Two shapes; only the first was in the original design.
   *Seeded:* `beginSession(rolls)` batches the seed with the activation, so priming's first pass already
   sees them. *Asynchronous* — the real cold-load path, where App holds only a save id and the rolls arrive
   from `GameplayContext`'s restore a beat later: priming has **already run** by then, so it must run
   **again** afterward to top up any placement the save predates. That is why the effect depends on `rolls`,
   and why it must return the previous object when nothing new was rolled — `primeRolls` always allocates,
   so dependency-plus-fresh-object is a render loop without the identity guard. Both shapes are pinned by
   tests; the dependency is mutation-proven.
2. **Re-entrancy wiping the pickers' rolls.** `beginSession` runs twice on the normal path — once from the
   flow, once from the handoff into the game view — so it no-ops when already active. Without that guard
   the name on the picker would not be the name in the game. Mutation-proven.
3. **Rolls leaking across worlds** — covered by the exits in the lifecycle table, not by a world watcher.
4. **Two sessions' worth of state** — one provider, one `beginSession` per entry path, all converging.
5. **Resolving with no session** — `useResolvedAuthoredWorld` must **never silently roll at resolve
   time**. Outside a session it resolves with empty rolls, so a missing `beginSession` shows as
   unrolled text rather than as a fresh roll on every render.

## Walked live (2026-08-08)

The three lifecycle cases tests alone cannot fully close, against the stress world
(`build-demo-world.mjs` in the session scratchpad — 8 placeholders, 56 chips, 13 traits, 13 pins):

| Case | Result |
|---|---|
| Abort and re-enter | No session before entry. Enter → `Turning`/`Marrow` + 6 unique rolls. Back *within* the flow → identical. Abort → inactive, rolls dropped. Re-enter → re-rolled (`Frostfall`/`Sedge`) |
| Mid-game toggles | Two Metal-pinning traits: both on → `Iron Temper` (later wins) · Ironblood off → `Copper` · both off → `Brass` (the frozen roll, intact) · back on → `Iron`. `Marrow Standing` never moved — the control |
| Save → load | Rolls persisted in the envelope. Exit → session inactive, rolls dropped. Cold-load → all 4 world + 6 unique rolls restored key-for-key, zero diffs; panel identical to pre-save |

Two limits on that evidence, so it is not over-read later:

- **No CDP input was available** (the pane reports viewport 0×0, so `read_page`/`computer` see an empty
  tree). Pickers were driven with DOM clicks; in-game steps called the real handlers off the React fiber
  (`setDisabledTraitIds`, `saveGame`, `onExitToMenu`, `onLoadSaveGame`). Real code paths and real renders —
  but **not** click-level wiring.
- The save was written via the context rather than through GameViewer, so it carried `worldId: null` and the
  load ran with the world already resident. The **world-fetch half of cold-load is still unwalked.**

Also worth knowing for any future pane session: the app picks its layout at mount, so a 0×0 pane mounts the
**mobile** layout and the desktop panels never render. Resize before loading, not after.

## The self-pin display rule (added 2026-08-08)

Live testing surfaced a confusion the session made visible: picking "Native of {Town}" renamed **every**
Town chip — including the *other* origin trait's card — so "Sworn to {Town}" read "Sworn to Sedge" the
moment Native was ticked. The card was reporting what the selection made true instead of advertising what
picking it does.

**Rule: a trait's own text resolves with its own pins layered over the active ones** (`traitScopedPins` in
`traitEffects.ts`). Its name (via the resolved collection), its descriptions, and the stat names printed on
its card all read the trait's own value, whatever else is ticked. Everything outside a card — stat bars,
locations, narration, group headings — keeps the active pins. Agreed decisions:

- **One rule everywhere**: AI-facing trait text (`aiDescription`, the trait context) self-pins too, so the
  AI reads the same words the player's card shows.
- **Conflicting non-exclusive pins accepted**: with Tarnished (Copper) and Ironblood (Iron) both active the
  world shows Iron and the Tarnished card keeps saying Copper. Each card describes its own pin; the world
  shows the winner.
- **Group headings cannot self-pin** — a group has no pins — so they follow the active selection. Authors
  putting a pinnable placeholder in a group heading accept that flicker; future linter material.
- The picker takes **authored stats** for the card stat lines: a pre-resolved name has no token left, so a
  per-trait resolution over it is impossible (the same trap as the playerStats seeding bug).

### The write-time freeze, and the two shapes it takes

Every bug in this area is the same one: **a resolved name written into state or a string is frozen at the
pins of that instant.** It has shown up three times — `playerStats` seeding, the "Applied trait" log, and
`currentLocation`. Two distinct fixes, depending on what is being written:

- **Stored objects → resolve on read.** `currentLocation` holds a whole location, so the copy gameplay keeps
  is a snapshot of how the name read on arrival. `useResolvedWorld` now re-derives it by looking the id up
  in the resolved `locations` (falling back to the stored copy if the world no longer has it), so a pin
  switched on later moves the name everywhere — the Location tab, the AI context, scene matching. Consumers
  take `currentLocation` from `useResolvedWorld()`, never from `useGameplay()`.
- **Log lines → resolve at the write, with the pins about to apply.** A log entry is a frozen string by
  design, so it must be resolved when written. The catch: the init effect applies the chosen traits and
  writes the location log in the same synchronous pass, and `setPlayerTraits` has not landed, so `resolvePH`
  there still carries the *old* (empty) pins. Hence `resolveWith(extraPins, text)` — resolve against pins
  that are not in state yet. The trait log uses `resolveTraitText` for the same reason.

## Deliberately unchanged

- **Save envelope / export shape** — rolls already live there. No shape change.
- **`GameplayProvider` mounts per game** — only rolls outlive it, and only until `endSession`.
- **Editor preview machinery** (`buildPlaceholderPreview`) — the World Editor never has a session.
- **`usePlaceholderResolver`** — reads through GameplayContext's delegated value.

## Slices

1. **Extract, behavior-identical.** New provider; GameplayContext delegates; priming moves; the session
   begins where GameViewer used to begin it. No visible change. *(The risky refactor, isolated.)*
2. **Move session start into the flow.** The three entry points plus the end triggers. Pickers still
   show braces.
3. **Pickers consume the session.** `useResolvedAuthoredWorld`, draft pins in the trait picker,
   `describePlaceholders` retreats.
4. **Docs.** This memo's outcome, the names memo's display matrix, changelog.

## What shipped

All four slices are in; the four gates are green. Live-verified in the preview against the hand-test world:
the trait card reads "Native of Marrow", the location step offers **Marrow Square** and **Marrow Docks**
(one town, agreeing), the stat panel in play reads "Marrow Standing" from the same roll, and ticking a
pinning trait flips a hair-colour line black → red → black as it is ticked and unticked.

Two things landed differently from the design above and are corrected in place: the world-change watcher was
dropped, and the cold-load hazard turned out to have a second, asynchronous shape that the original
hydrate-then-prime story did not cover.

## Decisions taken

- **Session begins at Enter World, not at world selection.** The world-details panel keeps
  `{red|brown}` while browsing, which honestly advertises that the world has variety; committing to a
  value is what entering means.
- **Abandon-and-re-enter re-rolls**, per the lifecycle table above.
