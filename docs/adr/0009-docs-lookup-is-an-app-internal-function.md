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

- **The lookup ships off.** Every help question uses retrieval mode, on every endpoint, and the capability check does not run. One field, `lookup` in the help settings value (`helpSettings.ts`), switches lookup mode on; its default is off. It is not a player setting yet and is in no preset or export. The code and its tests stay, so a later run can compare the modes again. Ticket 28 measured both on MeroMero v2 31B over 48 runs: retrieval answered 48 of 48 completely at 1,653 tokens in on average. Lookup answered 45 of 48 at 3,090 tokens in, and added one regression. The extra reads cost about twice the tokens and gave no better answers.
  - **Amended 2026-10-04: the default is off again.** Ticket 10 turned the default on, from ticket 22's older numbers (63% to 81% complete). Ticket 13 re-probed on the current docs and search. It ran MeroMero v2 31B on 18 questions, 3 runs per arm, 0 failed. Both arms answered 48 of 48 covered runs completely and flagged 6 of 6 uncovered runs. Lookup mode sent 9,138 tokens in per question against 8,576 for retrieval (+7%), and it changed no outcome. The set holds no question that the keyword search misses, so both arms sit at the ceiling. The probe cannot measure what lookup mode is for. Lookup mode stays a hedge that a player turns on (spec Q52).
- **The docs lookup is not a Tool.** It has no catalog entry, no handler and no preset switch. It does not show in the **Tools** tab, and the **Output → Tools** switch, the Tool call limit and the catalog overrides do not affect it.
- **It uses the capability gate of Tools.** With lookup mode on, a help request offers the function only to an endpoint and model known to take function calls. Every other endpoint gets retrieval mode: the app runs the keyword search and puts the sections in the prompt.
- **The mode is chosen before the request.** A failed request is never sent again in the other mode. This keeps the "no runtime fallback" rule of ADR-0008.
- **It runs through the existing tool loop** with its own executor. The request layer and the loop take any offered function (`OfferedFunction`: id, name, description, parameters, call limit). A Tool is one; the docs lookup is another.
- **The prompt holds the search hits, and no contents list.** A lookup request starts with the same docs sections as a retrieval request. The model finds other sections by search words, or reads them by the ids it has seen in the prompt and in earlier results.
- **Its limits are its own.** The call limit is a constant of the help session. The round cap is the tool loop's default. The fetched text of one question has its own budget, in addition to the prompt's sections.

## Consequences

- The Tool types, the Tool Runner and the settings shape are unchanged. No preset and no export gains a field.
- A value of type `OfferedFunction` cannot reach the Tool Runner or the **Tools** tab, so the boundary holds in the types.
- Lookup mode costs more tokens than retrieval mode: each call is one more round, and it carries the fetched text. On MeroMero v2 31B it measured 3,100 tokens in per question against 1,700. A contents list in the prompt cost about 3,900 tokens more and gave no better answers (ticket 28).
- A player whose endpoint takes no function calls gets retrieval mode with no notice. The default cloud endpoint is one of these today.
- A later app-internal function follows the same pattern: its own module, its own executor, the shared gate.

## Alternatives rejected

**A catalog Tool offered to the help prompt:** reuses everything, but the player could switch it off, a preset could drop it, and the **Tools** tab would list a function that reads no world data. Help must work before the player has set anything up.

**A second request path for help:** keeps the Tool code untouched, but duplicates the round loop, the answer cap, Stop and the failure handling.

**Retry in retrieval mode when a lookup request fails:** every question gets an answer, but it costs a failed request and hides an endpoint that rejects function calls.
