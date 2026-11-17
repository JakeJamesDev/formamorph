# Spec: Steady Narration

Status: ready-for-agent
Spec session: steady-narration — spec

## Problem Statement

With Character Mentions on, the narration flickers and restarts while a turn streams. The reveal replays from the start many times per turn, most visibly while the choices stream in.

A runtime probe on one turn showed the cause. The speaker colors that Character Mentions passes to the narration got about 50 new identities in 11 seconds, with the same content each time. Each new identity gave the renderer new plugins, which remounts it and restarts the reveal. Committed turns in the chat layout remount the same way.

The colors churn because the mention card rows rebuild the whole Player View on every game-state change. They reach it through the save-state getter, whose identity changes when any of about 35 pieces of state change: choices, the message history, the log, the page, and more. None of those except the entity state touch the rows. Presence also rebuilds on every history write, which rebuilds the rows again.

## Solution

The narration stays steady through a turn. It replays only when the speaker colors really change, for example when a new speaker becomes visible.

- The mention card rows and the pick list read an entities-only part of the Player View. That part depends only on the state the entity rows read.
- The save-state getter keeps one identity for the session. Every remaining user calls it on demand and still reads the current state.
- Presence recomputes only when the content of the recent scene turns changes.
- As a backstop, the card rows and the speaker colors keep their previous identity when a rebuild gives equal content.

## Rulings

Settled with the user on 2026-11-16, in grill order.

| # | Ruling |
|---|---|
| Q1 | Fix every eager consumer of the save-state getter and the Player View reach, not only the mention path. The eager consumers today are the card rows and pick list memo, and the panel actions and inventory settle memos through the action snapshot. |
| Q2 | No stopgap patch ships ahead of this spec. |
| Q3 | Done means: during a turn, zero rebuilds of the card rows and speaker colors while choices and history stream, and the narration never remounts; plus a test that fails if the churn returns. |
| Q4 | The card rows and pick list use an exported entities-only builder, fed only the state the entity rows read. They stop calling the Player View reach. |
| Q5 | The save-state getter becomes a stable getter that reads the latest state from a ref. A comment and a test guard against a future eager memo on it. |
| Q6 | Presence recomputes only when the recent scene turns' content changes, not on every history write. |
| Q7 | The card rows and speaker colors keep their previous identity when a rebuild gives equal content. |
| Q8 | New evidence from ticket 02: the markdown library caches its processor by plugin name plus the JSON of its options, and the colors Map serializes as `{}`, so a new speaker's quote stays uncolored after the remount. Ticket 05 fixes it in this effort: the speaker source serializes everything the quote plugin reads. The renderer's plugin keying stays out of scope. |
| S1 | The two test seams are the game viewer render harness and the Player View module tests (confirmed with the user). |

## User Stories

1. As a player with Character Mentions on, I want the narration to reveal once from start to end, so that I can read it without it jumping back.
2. As a player, I want the narration to stay put while the choices stream in, so that the end of a turn does not flash.
3. As a player, I want the narration to stay put while background passes write to the story, so that stat, location and memory updates do not restart the text.
4. As a player in the chat layout, I want earlier turns to stay still while a new turn streams, so that scrolling back shows steady text.
5. As a player, I want a quote to change color when its speaker first becomes known, so that colors stay correct even mid-turn.
6. As a player, I want a correction I make on a mention card to show at once, so that my fix is visible.
7. As a player with Character Mentions off, I want nothing to change, so that the fix costs me nothing.
8. As a player on a slow machine, I want the game not to rebuild the whole Player View on every state change, so that streaming stays smooth.
9. As a player, I want the pick list on a mention card to offer the same people as before, so that the fix changes no behavior.
10. As a player, I want the mention cards to show the same rows, images and descriptions as before, so that the fix changes no content.
11. As a player using the inventory and action panels, I want them not to recompute on every state change, so that the panels stay responsive during a turn.
12. As a player, I want an action snapshot and restore to still capture the current game state, so that undo-like flows keep working.
13. As a player asking Formaquestion in game, I want it to still read the current Player View, so that help answers stay accurate.
14. As a developer, I want a test that fails when the narration remounts on a state change that does not change the colors, so that this regression cannot come back silently.
15. As a developer, I want the entities-only builder to match the full Player View's entity rows, so that the two cannot drift.
16. As a developer, I want the stable save-state getter to say why no memo may depend on it, so that nobody brings the churn back.

## Implementation Decisions

- **Entities-only builder.** The Player View module exports a builder that returns only the entity rows, the same rows the full builder returns. The full builder calls it, so there is one code path. Its inputs are the entity-relevant state only: discovered entities, entity positions, generic and unique states, the current location, the met list, stranger aliases, the visible-entity records of each saved state in the chain, the world's entities, locations and connections, the persona, the text resolver, the entity-on check, and the gate (for images).
- **The chain for the builder.** The number of saved states in the chain depends on the count of closed turns in the history. That count is memoized as a number, so history writes inside a turn do not change it. The builder reads the saved states' visible-entity records and the current visible-entity record, not the full saved state.
- **Card rows and pick list.** Their memo depends on the builder's inputs, presence, the resolver and the met list. It no longer depends on the Player View reach or the save-state getter. Its world input is the in-play world built from the authored entities, locations and connections, memoized, so the deps are visible to the linter (ticket 02).
- **Stable save-state getter.** The game state context keeps the latest state in a ref and exposes a getter with one identity. On-demand callers (the action snapshot, the deferred snapshot, the help world sources, handlers) still read the current state. Its comment states that no eager memo or effect may depend on it.
- **Player View reach.** It stays as it is. After this change nothing eager depends on it.
- **Presence.** It derives the recent scene turns and memoizes them by content. A history write that leaves those turns unchanged leaves presence unchanged. The key is the derived scene turns, so a text edit that changes no participant also keeps presence (ticket 03).
- **Backstop.** A small helper keeps a map's previous identity when the new map has the same keys and each value is equal. Speaker colors compare values directly. Card rows compare rows shallowly, with image data compared by reference. Array fields on a row, such as seen aliases, compare element by element, one level deep, because the builder makes them fresh on every build (ticket 02). The speaker-color identity contract stays: a real color change still gives a new map, so a new cast member repaints.
- **No export-shape change.** World and save files are unchanged.

## Testing Decisions

- A good test drives the game the way play does and checks what the player sees. It does not read memo internals.
- **Game viewer seam (main).** Use the existing game viewer render harness with Character Mentions on and a turn with a colored quote. Stream choices and write to the history mid-turn. Assert the narration's root DOM node is the same node before and after. Then make a new speaker visible and assert the node is replaced once. Prove the test bites by reinstating the old dependency on the save-state getter: it must fail.
- **Player View seam.** In the existing Player View module tests, assert the entities-only builder returns the same rows as the full builder for the fixtures already there, including unidentified entities.
- **Stable getter.** A test asserts the getter keeps its identity across state changes and returns the current state.
- **Backstop helper.** Same content gives the previous map; an added, removed or changed entry gives a new one.
- Prior art: the game viewer tests built on the shared render harness, the Player View and Player View World tests, the quote speaker identity tests, and the mention card tests.
- The runtime probe from the diagnosis (a fiber sample of the speaker colors and the renderer key during a real turn) confirms the done-state in the live app.

## Out of Scope

- Changing how quote colors are read or painted while streaming.
- Changing the renderer's plugin keying.
- Reworking the Player View reach or the help world sources beyond what Q1 needs.
- Performance work on the full Player View builder.

## Further Notes

- Diagnosis on 2026-11-16, White Room dev fixture, Pages layout, cloud endpoint. During the reveal only the save-state getter changed upstream; during the choices burst it changed about every 40 ms.
- An independent read-only review confirmed no other identity source remounts the renderer during a live turn.
