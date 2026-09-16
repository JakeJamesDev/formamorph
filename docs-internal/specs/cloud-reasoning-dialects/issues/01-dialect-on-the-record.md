# 01: Dialect On The Record, Spelled By The Request Builder

Status: ready-for-human
Status note: Built and committed as c4901429. Four gates green, 10,314 tests in 75s. Reviewed on both axes; findings folded in. One gap left for ticket 02, recorded under Comments.
Base: 685b4152
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Cloud Reasoning Dialects](../spec.md)

**What to build:** The capability record names a reasoning dialect, and the request builder spells the budget and the off switch from a dialect table instead of one hard-coded field. A player on LM Studio or the built-in engine sees nothing change: same controls, same fields on the wire, same token counts. The AI Context viewer's endpoint line shows the reasoning fields as they were sent. An endpoint with no known dialect gets exactly today's body.

**Rationale for the model:** the change threads the record, the resolver's existing sources, the request builder, the endpoint line, and the settings controls, with an exact-bytes compatibility bar. Opus at high effort.

## Acceptance criteria

- [ ] The record carries a dialect answer with a source beside reasons, levels, and budget. Known dialects and unknown are named values; the parser loads a stored record without a dialect as unknown.
- [ ] A dialect table names, per dialect: the budget key shape, the off-switch shape, whether off is allowed, and whether an effort level is sent. The request builder reads only the table; no endpoint logic lives in the builder.
- [ ] The existing sources name their dialect: LM Studio's native list marks lmstudio, the built-in engine marks engine, a vLLM models-list shape marks vllm. Every other source leaves it unknown.
- [ ] Unknown dialect produces the same wire body as today for every existing request-spec case, asserted by reusing those cases unchanged.
- [ ] LM Studio and the built-in engine produce the same body as today, asserted the same way.
- [ ] The vllm dialect spells the budget as `thinking_token_budget` and off as `reasoning_effort: none`, but sends a budget only when the record says budget yes, which nothing in this ticket sets for vLLM.
- [ ] The resolved choice none on a dialect that rejects off sends no reasoning field at all. The prompt and Output switches render checked and disabled on such a record, with the existing short note reworded to say the model always reasons.
- [ ] The prompt Options control shows the slider wherever the record names a budget key and says budget yes, the dropdown wherever the dialect sends an effort level, and both under one switch where both apply, as today.
- [ ] The AI Context viewer's endpoint line shows the reasoning fields in the spelling that went out, with a test per known dialect.
- [ ] Request-spec tests add one case per dialect row for the budget spelling and one for the off spelling. Resolver tests assert the dialect and its source per existing source.
- [ ] Typecheck, lint, tests, and build pass; report test wall time; prove the unknown-dialect compatibility guard fails when the table's unknown row is changed. Update the code graph. Changelog In Progress entry, ⚙️ bucket only: no player-visible change lands in this ticket.

## Scope notes

Expand step. No cloud identity detection yet; that is tickets 02 to 05. No new settings, no export-shape change.

## Comments

**2026-09-15 — built, reviewed, handed over.**

Every acceptance criterion is met. The full dialect table landed here on the spec session's ruling, Google as two rows, with the Anthropic clamp and the Google 2.5 level-to-budget mapping as row properties. Field spellings came from the live provider docs on 2026-09-16, listed in the table's own docstring.

Two design points the build settled, both confirmed by the spec session:

- A dialect with its own off field sends that alone, never a budget beside it. OpenRouter and google-2.5 reject the pair.
- On google-2.5 the level and the budget land in the same field, so the player's own budget wins it and the level mapping applies only where the record says no budget.

The review found one real bug, now fixed: an explicit off row wrote its field without consulting the record, so a vLLM server marked from `max_model_len` before anything answered the levels question would have been sent `reasoning_effort: none` where it is sent nothing today. The hosted Default is one of those servers. Off now comes in three shapes — the guarded `none` literal, an identity-named field of the dialect's own, or refused — and two tests cover it, both proved red against the reinstated bug.

**Open for ticket 02.** On a dialect that refuses off, a prompt left switched off sends no effort literal at all, so the model spends its own default while the locked switch reads as on. The strength dropdown is live and applies on every prompt whose own switch is on. Closing this needs the record-level off-allowed answer that ticket 02 adds, sourced from OpenRouter's `mandatory` flag, since the fix is to resolve such a prompt to its stored level rather than to `none`.

**Also for ticket 02.** `mandatory` on an OpenRouter model entry still only drops `none` from the record's levels, as before. Whether off is rejected is a dialect property here, not a per-model one, so a mandatory OpenRouter model does not yet lock its switch.

**Live check.** The UI was verified in the running app, not only in jsdom. A stored record carrying no dialect loaded as `unknown` and kept both the switch and the Reasoning Budget slider. A seeded `moonshot-k3` record hid the slider, showed the note, and rendered the switch checked and disabled on Stat Updates, whose shipped setting is off — which is the case that proves the lock overrides the stored switch rather than agreeing with it by chance.
