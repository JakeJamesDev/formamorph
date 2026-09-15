# Reasoning Capability and Budget

Status: ready-for-agent
Spec session: Reasoning Capability and Budget

## Problem Statement

A player who runs a reasoning model wants Formamorph to know that the model reasons, to send it the right controls, and to cap how long it thinks. Today the app decides whether a model reasons in three different ways. On LM Studio it reads the native model list. On every other endpoint it sends up to seven tiny completions and reads the status codes, which tells it whether the server validates a field, not whether the model thinks. On the built-in engine it assumes yes. A model on Ollama, a llama.cpp server, or a cloud gateway that advertises its capabilities is still probed blind, and a model that plainly shows its reasoning in every reply is never believed.

The Reasoning Budget slider, an exact token cap, only reaches the built-in engine. LM Studio accepts the same cap on the same endpoint Formamorph already talks to, and the app never sends it. So a player on LM Studio has a coarse level while the exact control sits unused.

## Solution

One capability record per endpoint and model answers three questions: does this model reason, which effort levels does the endpoint accept, and does it take a token budget. The record is filled by an ordered chain that asks the cheapest reliable source first. The backend's own capability list, when it has one. A public model catalog matched on the model id. What the model's replies have already shown. And only as a last resort, a single probe.

Every request reads that record. LM Studio gets the token budget, with the effort level beside it. The built-in engine keeps its budget. Other endpoints keep the effort level. A model the record marks as non-reasoning gets no reasoning fields at all, and its controls hide as they do today.

## User Stories

1. As a player on LM Studio, I want the Reasoning Budget slider to cap the model's thinking, so that a turn does not stall in a long scratchpad.
2. As a player on LM Studio, I want the budget to apply to every prompt that has one, so that planning passes stay short while narration keeps its share.
3. As a player on LM Studio, I want a switched-off prompt to send a zero budget, so that a reasoning model answers directly on bookkeeping calls.
4. As a player on LM Studio, I want a Global prompt to follow the Output switch, so that turning reasoning off once turns it off everywhere.
5. As a player on Ollama, I want the app to read the model's advertised capabilities, so that it knows the model thinks without sending test completions.
6. As a player on a llama.cpp server, I want the app to read the server's template capabilities, so that the effort control appears only where the template honors it.
7. As a player on a cloud gateway that lists supported parameters, I want the app to read that list, so that the controls match what the gateway accepts.
8. As a player on any endpoint, I want a well-known model id to be recognized from a catalog, so that the app knows a reasoning model before the first turn.
9. As a player on any endpoint, I want a reply that shows reasoning to mark the model as reasoning, so that the app learns from what it sees.
10. As a player on any endpoint, I want a reply with no reasoning under a positive effort level to mark the model as non-reasoning, so that the controls stop pretending.
11. As a player on an unknown endpoint, I want at most one probe request, so that connecting does not fire a burst of completions.
12. As a player, I want the record cached per endpoint and model, so that switching between two setups does not re-detect each time.
13. As a player, I want a change of model or endpoint to start detection again, so that a stale record from another model never applies.
14. As a player, I want the Native Reasoning controls to show only when the record says the model reasons or is still unknown, so that a non-reasoning model shows the same short note it shows today.
15. As a player, I want the strength dropdown to list only the levels the record says the endpoint accepts, so that a pick never fails a turn.
16. As a player on the built-in engine, I want the budget slider to keep working exactly as it does now, so that this change costs me nothing.
17. As a player on an endpoint with no budget support, I want the effort level sent and no budget field, so that a strict server does not reject the request.
18. As a player, I want an endpoint that rejects the budget field on a non-reasoning model never to receive it, so that no turn errors.
19. As a player, I want the AI Context viewer's per-request endpoint line to show the effort level and the budget tokens that request carried, so that I can see what was sent.
20. As a player on a budget-capable target, I want each prompt's Options tab to show both the level dropdown and the budget slider under one switch, so that I can see and set both of the values that request carries.
21. As a player with an older cached effort list, I want it to load into the new record, so that nothing re-probes on update.
22. As a developer, I want one pure resolver with an injected fetch, so that every backend shape is tested without a server.
23. As a developer, I want the request builder to read one record on the target, so that the wire body is asserted from a plain snapshot.
24. As a developer, I want the settings context to be a thin caller of the resolver, so that detection logic never lives in React.
25. As a developer, I want the catalog fetched once per session and never on the turn path, so that a slow catalog cannot delay a turn.
26. As a developer, I want the observed-reply signal recorded by the settings context from the AI Stream's reasoning events, so that the stream itself stays free of detection.
27. As a developer, I want the record to say where each answer came from, so that a wrong detection can be traced to its source.

## Implementation Decisions

**One record.** A reasoning capability record replaces the bare effort list on the endpoint target. It carries: whether the model reasons, as yes, no, or unknown; the effort levels the endpoint accepts; whether the endpoint takes a token budget; and the source of each answer. The record is the only thing the request builder, the settings UI, and the Request Anatomy read.

**Resolution chain.** A pure async resolver takes the target, a fetch, and the observation for that endpoint and model, and returns the record. It walks an ordered chain and stops at the first conclusive answer for the reasons question, then fills the levels and budget from the same source where it can:

1. Native advertisement, chosen by which endpoint answers with the expected body shape. Status codes never identify a source: LM Studio answers a foreign path with 200 and an error body, so a source counts only when the body has no error key and the expected field is present. LM Studio's native model list, whose reasoning capability object also lists allowed options, mapped to the app's level literals; an option with no literal of ours is dropped, so an on/off model lists none alone. Ollama's show endpoint, whose capabilities array names thinking; a missing array means unknown, never no. A llama.cpp server's properties endpoint, whose template capabilities say whether effort is honored; the flag is missing on older builds, and llama.cpp never says whether a model thinks. A gateway model list whose entries carry a reasoning object with supported efforts, mapped one to one; a mandatory flag drops none from the levels so switch-off omits the field. Entries with only a supported-parameters list answer the reasons question from reasoning or reasoning effort in that list.
2. Catalog match on the model id against the models.dev catalog, loaded once per session and cached with a long lifetime. A hit gives the reasons answer only; levels and budget stay unknown.
3. Observation. A recorded reply that carried reasoning marks yes. A recorded reply with none under a positive effort marks no.
4. One probe of the none literal, as the current probe does for its first step. A rejection marks no. Acceptance leaves the reasons question unknown and the levels at the safe fallback.

The seven-literal probe goes away. Level support beyond the safe set comes only from a source that lists it, and both LM Studio and the gateway shape do. The probe memo records any conclusive foreign answer as known-absent, not only a 404: a 405, a 415, or a 200 whose body carries an error key, so each source is asked at most once per session.

**Budget routing.** The request builder sends the token budget to any target whose record says the endpoint takes a budget and the model reasons. LM Studio and the built-in engine both take it under the same field name. Effort is sent beside the budget where the record lists accepted levels, and never on a target whose record says the model does not reason. A switched-off prompt, a Global prompt under a switched-off global, and Inline narration all resolve to none, and none sends a zero budget wherever a budget goes.

**Budget support detection.** LM Studio is marked as taking a budget when its native model list answers, since its chat completions endpoint accepts the field for reasoning models. The built-in engine is always marked. No other backend is marked in this spec.

**Observation signal.** The settings context records, per endpoint and model, whether the most recent reply carried reasoning and what effort was in force. The AI Stream already emits reasoning events. The context feeds the observation into the resolver and re-resolves when the observation changes a previously unknown answer. The stream is not changed.

**Cache and invalidation.** The record is cached per endpoint and model under the existing bounded cache, keyed as today. An older cache holding a bare effort list loads as a record with those levels, reasons unknown, budget unknown, source cache. Source precedence is native, then catalog, then observation, then probe, then cache. The resolver runs whenever any answer is unknown or cache-sourced, and a higher-ranked source overwrites a lower-ranked answer, so a stale seven-level list from before the update is replaced the first time the endpoint's native list answers. A model or endpoint change reads the cache first and resolves on the same rule.

**UI.** The Native Reasoning controls hide behind the existing short note when the record says the model does not reason. The strength dropdown lists the record's accepted levels, or the safe fallback while unknown. The prompt Options control shows the level dropdown on every target that sends the effort field, and adds the budget slider under it when the record says the target takes a budget; one switch governs both. The built-in engine ignores the effort field, so it shows the slider alone. The Output row always shows the effort dropdown. (Decided 2026-09-15 after the user asked for both controls; supersedes the earlier slider-only reading.) The AI Context viewer's per-request endpoint line shows the effort level and budget tokens the request carried. Request Anatomy is unchanged: it draws prompt text, not request parameters.

**No export-shape change.** The record lives in the settings cache, not in presets or saves.

## Testing Decisions

A good test feeds plain inputs to a seam and asserts what a player or a server would see, never how the answer was reached.

**Request building** is tested through the existing request-spec tests: a snapshot with a target whose record has a given shape, a call of a given kind, and the exact wire body. Cases cover LM Studio with budget and effort, the built-in engine with budget only, a plain endpoint with effort only, a non-reasoning record with neither, a switched-off prompt sending zero budget, and the unknown record sending nothing.

**Capability resolution** is tested through the resolver with a mocked fetch, following the existing LM Studio capability tests. One case per backend shape answers each question, plus the catalog hit, the observation override, the single probe, the inconclusive path, and the source recorded on each answer. A test asserts the probe count never exceeds one.

**Settings context** keeps its current routing and pin tests. One added test asserts the cache migration from a bare effort list.

**Live verification** repeats the standalone budget probe against LM Studio through the real app once, and records the reasoning token counts at two budgets in the changelog entry.

## Out of Scope

- The llama.cpp early-stop control endpoint. A client-side budget for servers without one is a separate effort.
- Budget support on Ollama or cloud gateways. None advertises a token cap today.
- Changing the per-prompt defaults, the switch-plus-strength control, or the Inline narration rule. Those shipped.
- A reasoning budget message. LM Studio takes it at load time, not per request.
- Reading the capability of image, embedding, or speech models.

## Further Notes

The LM Studio budget field is undocumented. It was confirmed from the app bundle and the SDK source, and verified live on LM Studio 0.4.21 with a 31B reasoning model: budgets of 200, 50, and 0 landed on 199, 49, and 0 reasoning tokens, answers coherent at each. The design memo under thinking-modes records the sources.

The models.dev catalog is a public JSON file of about 7800 models across 200 providers with a per-model reasoning flag. It is a hint for the reasons question only. Level and budget support still come from the endpoint.
