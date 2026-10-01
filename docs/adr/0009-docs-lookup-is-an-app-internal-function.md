# ADR-0009 — The docs lookup is an app-internal function call, outside the Tool catalog

**Status:** Accepted · **Date:** 2026-10-01

## Context

Formaquestion answers a help question from the player docs. Keyword search picks the docs sections for the request, and it picks the wrong section for many questions that a player words in their own way. A model that can call a function can pick the sections itself.

The app already has function calls: a **Tool** is a function the AI calls during a turn, defined in settings and enabled per prompt preset ([ADR-0008](0008-tools-are-preset-scoped-and-capability-gated.md)). The docs lookup uses the same wire format, but it is a different kind of thing:

| | Tool | Docs lookup |
|---|---|---|
| Who defines it | The player, or the catalog | The app |
| Who turns it on | A prompt preset, and the **Output → Tools** switch | Nobody. It is part of the help request |
| What it reads | The world and the playthrough | The bundled docs only |
| Where the player sees it | The **Tools** tab | Nowhere |

## Decision

- **The docs lookup is not a Tool.** It has no catalog entry, no handler and no preset switch. It does not show in the **Tools** tab, and the **Output → Tools** switch, the Tool call limit and the catalog overrides do not affect it.
- **It uses the capability gate of Tools.** A help request offers the function only to an endpoint and model known to take function calls. Every other endpoint gets retrieval mode: the app runs the keyword search and puts the sections in the prompt.
- **The mode is chosen before the request.** A failed request is never sent again in the other mode. This keeps the "no runtime fallback" rule of ADR-0008.
- **It runs through the existing tool loop** with its own executor. The request layer and the loop take any offered function (`OfferedFunction`: id, name, description, parameters, call limit). A Tool is one; the docs lookup is another.
- **The prompt holds the search hits, and no contents list.** A lookup request starts with the same docs sections as a retrieval request. The model finds other sections by search words, or reads them by the ids it has seen in the prompt and in earlier results.
- **Its limits are its own.** The call limit is a constant of the help session. The round cap is the tool loop's default. The fetched text of one question has its own budget, on top of the prompt's sections.

## Consequences

- The Tool types, the Tool Runner and the settings shape are unchanged. No preset and no export gains a field.
- A value of type `OfferedFunction` cannot reach the Tool Runner or the **Tools** tab, so the boundary holds in the types.
- Lookup mode costs more tokens than retrieval mode: each call is one more round, and it carries the fetched text. The first probe, with a contents list of about 3,900 tokens in the prompt, measured 7,800 tokens in per question against 1,700.
- A player whose endpoint takes no function calls gets retrieval mode with no notice. The default cloud endpoint is one of these today.
- A later app-internal function follows the same pattern: its own module, its own executor, the shared gate.

## Alternatives rejected

**A catalog Tool offered to the help prompt:** reuses everything, but the player could switch it off, a preset could drop it, and the **Tools** tab would list a function that reads no world data. Help must work before the player has set anything up.

**A second request path for help:** keeps the Tool code untouched, but duplicates the round loop, the answer cap, Stop and the failure handling.

**Retry in retrieval mode when a lookup request fails:** every question gets an answer, but it costs a failed request and hides an endpoint that rejects function calls.
