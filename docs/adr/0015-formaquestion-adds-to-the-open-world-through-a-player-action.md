# ADR-0015 — Formaquestion may add to the open world in a World Editor, through an action the player clicks

**Status:** Accepted · **Date:** 2026-10-31 · **Amends:** "It only answers: it never navigates and never edits a world" in the Formaquestion glossary entry

## Context

Formaquestion answers questions. The glossary says it never navigates and never edits a world. Two features already act on the editor from an answer: **Insert** writes a code block into the open script home, and **Take Me There** opens the screen an answer is about. The Formaquestion Intents spec adds entity cards: a reply drafts an entity in a fenced block, and the card's **Add** puts it in the open world.

## Decision

- **Formaquestion may change the open world only in a World Editor,** the in-game World Editor included, and only when the player clicks an action on an answer. The model never writes on its own: no Tool, no function call and no reply text changes the world.
- **The editor owns the write.** The World Editor registers each action beside its read source in the help world registry (Add) or in its own bridge (Insert). The game registers none, so the game side cannot write.
- **A write goes through the editor's normal path,** so the editor's undo records it and its save and autosave cover it.
- **Navigation is an action too.** Take Me There and Add's selection move the editor only on the player's click.

## Consequences

- An entity card's Add works on the world open now, wherever the card came from.
- A card on any other screen shows Add as unavailable, with the reason.
- Formaquestion Tools stay read-only.
- No world or save export changes shape.

## Alternatives rejected

**A Tool that writes the entity:** the model would change the world without a click, and an endpoint without Tools could not draft.

**Writing in game:** gameplay never writes the authored world, so the game registers no action.
