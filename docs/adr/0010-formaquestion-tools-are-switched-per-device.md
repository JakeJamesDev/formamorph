# ADR-0010 — Formaquestion Tools are a list of their own, switched per device, and never scoped to a prompt preset

**Status:** Accepted · **Date:** 2026-10-03

## Context

A **Tool** is a function the AI calls during a request ([ADR-0008](0008-tools-are-preset-scoped-and-capability-gated.md)). The player defines it once in Settings, and a prompt preset switches it on for the prompts it names. The **Output → Tools** switch gates every one of them.

**Formaquestion** answers a help question from the player docs. Its one app-internal function, the guide lookup, is no Tool ([ADR-0009](0009-docs-lookup-is-an-app-internal-function.md)). A dedicated player wants more: Tools of their own in a help question, so Formaquestion can work as a chat assistant that reads the open world (Formaquestion Settings spec, Q33–Q38).

The help request has no prompt preset of the game's kind. A help preset holds the three help prompts, and every other help setting is a device setting that applies to every preset (Q10, Q53). The request is one request: there is no "Offered To" to choose.

## Decision

- **Formaquestion Tools are a separate list.** They live in the help settings value on the device, beside the other device settings, and never in the gameplay Tool store. A Tool made in Formaquestion never goes to a game prompt. A gameplay Tool does not show in Formaquestion.
- **Each Formaquestion Tool has a switch, stored on the device.** A Tool the player saves new starts on, as on the gameplay tab; an imported Tool starts off (Q63). No prompt preset and no help preset owns the switch. A help preset file may carry the Tools and their switches as a copy (Q39), as a shared gameplay preset carries its Tools.
- **The gameplay Tool types, editor and pack file are reused unchanged.** The Tool shape, the Tool Runner, the Tool editor and the Tool pack file are the same. A pack exported from one list imports into the other, under the import rule both lists share: a Tool whose name the list already holds is skipped and named. The pack shape does not change. A Tool made in Formaquestion carries an empty prompt list in the pack.
- **The fixed functions of the help request are built-in names.** A Formaquestion Tool cannot take the name of the guide lookup, or of any later fixed function, at save, import or copy. The rule reads the fixed-function list, not a literal. The stored list applies it on read too, so a Tool whose name a later release reserves drops instead of shadowing the function.
- **The capability gate of ADR-0008 stays.** A Tool goes out only when the Answer Endpoint is known to take function calls. The **Output → Tools** switch is not read (Q37).
- **A Tool reads the open world, else nothing.** In the game it reads the playthrough's Tool Snapshot, as a game Tool does. In the editor it reads the world as the editor holds it, unsaved edits included, at its opening. The source mounted last wins, so the in-game editor reads over the game while it is open, and the game's live world returns when it closes (Q63). On every other screen it runs on an empty snapshot and returns its empty result. Try It follows the same source.
- **A Tool is no search source.** The bare-question rule (Q41, Q51) and the prompt choice do not read the Tool list. With a Tool on and the guide lookup off, the request uses the retrieval prompt and offers the Tools.

## Consequences

- The help settings value gains two fields, the Tool list and the switches. No world, save or preset export changes shape.
- A Tool that is on can send text of the player's world to the help endpoint, which no help request did before. The Tools tab states this next to the list.
- Two Tool stores exist. A player who wants one Tool in both lists imports it twice, through the pack file.
- The one Tools tab component serves both lists. Its caller decides whether a prompt preset is involved.

## Alternatives rejected

**One shared Tool list with a help switch per Tool:** one store, but every Tool would carry a field that means nothing to the game, and a game Tool would show in Formaquestion with its narration wording (Q47).

**Formaquestion Tools owned by the help preset:** a preset switch as the game has, but every other help setting is a device setting (Q10), and a preset switch on a one-request surface buys nothing.

**Formaquestion Tools read no world:** keeps the help request free of world text, but the point of a Tool here is to read the world. The notice on the tab carries the trade-off instead.
