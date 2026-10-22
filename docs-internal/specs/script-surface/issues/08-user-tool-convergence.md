# 08: User Tool Convergence

Status: done
Blocked by: 01, 03, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a shipped sandbox changes its whole surface, the runtime builds the script shapes from a different snapshot, and the Tool editor's tree and cards follow.

## What to build

A user Tool script reads the script surface, read-only: `args`, `entities`, `locations`, `location`, `memories`, `clock`, `persona`, `dictionaries`, `stats`, `traits`, `placeholders`, `notes`, `console` (spec: Surface, User Tool scripts after convergence). Every entry has the shape the Scripts surface gives it, with every verb absent, so a call is an ordinary not-a-function error (Q24). `world` and `scene` are gone (Q26). `notes`, the player's notes, is a string global on both surfaces. `clock` always exists; outside a game it reads the opening. The user Tool runtime builds the shapes from its Tool Snapshot, including the memories entries from the snapshot's memories. The user Tool surface composes from the script surface minus writes plus `args` and `console`; the Tool editor's Variable menu and cards show it; the guide links move with it. Formaquestion Tools, which share the sandbox, read the same surface. A World Tool script is unchanged beyond gaining `notes`.

Spec: Q22, Q24, Q26, stories 16, 20.

## Acceptance criteria

- [x] A user Tool script reads `entities.Mira.location`, `location.present.length`, `memories.at(-1).text`, `dictionaries.Lore.entries` and `notes` from a Tool Snapshot; a test builds one snapshot and asserts each — `toolSnapshot.test.ts` "reads an entity’s place, who is present, the last memory, a book’s entries and the notes"
- [x] `memories.add`, `memories[0].pin`, `location.move`, `entities.Mira.move` and `diary` are absent; a call fails as not a function and the Tool returns the error — `toolRunner.test.ts` "has no verb: …" (eight calls); `memories[0].pin` lands with ticket 05 and the view drops every own function, so it is absent by the same rule
- [x] `world` and `scene` are undefined in the sandbox and marked unknown in the editor — `toolRunner.test.ts` "has no world, scene, self, owner, discover or player"; `toolScriptSurface.test.ts` "marks the retired globals unknown"
- [x] `clock` reads the opening on a screen with no game; a world script reads `notes` — `toolSnapshot.test.ts` "reads the opening clock and no memories on a screen with no game" and "a world script reads the player’s notes"
- [x] The Tool editor's Variable menu and cards list the converged globals and no old ones — `toolScriptMenu.test.ts`, `codeCards.test.ts` "codeCard: a Tool script", `ToolsTab.edit.test.tsx` reference list
- [ ] Four gates green

## Blocked by

- 01 (Locations Map And Entity Place)
- 03 (Memories Reads)
- 06 (Dictionary Entries)

## Landed

**Not verified**

- Four gates green: the review gates (typecheck, changed-file lint) passed; prepare runs all four and lands only when they pass.
- The Tool editor live: the Variable menu, cards and reference list pass their jsdom and unit tests, but the live preview read was blocked by the contest panel and a stale pane frame.
- A user Tool's snapshot starting over after an On Call World Tool writes mid-turn: inline in GameViewer, checked by reading only.

**For you**

- Settings → Tools → a Tool with a Script handler: open **Variable** and **What a Script Can Read**. The list reads `args`, `stats`, `clock`, `locations`, `location`, `memories`, `notes` and the maps, with no `world`, `scene` or calls.
- Try It on `stats.<Stat>.value = 1; return "x";`: the result shows the **Read-only fields** line and the Tool still answers.

**Notes for later tickets**

- A user Tool's `placeholders` entries read as a Script's do, so an entity placeholder holding `{{char}}` no longer resolves per owner (spec: Migrations).
- `roll()` is absent on placeholder entries in a user Tool, since no verb exists there.
- A thrown `Error("interrupted")` now reports as a script error in every script, not a timeout; only QuickJS's own interrupt counts.
- A `### Notes` section and a `notes` Quick Reference row went into the Scripts Guide for the guide-link guard; ticket 10 owns the rest of the guide.
