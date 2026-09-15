# 03: Anthropic And Google By Host

Status: ready-for-human
Status note: Built on base c4901429. Four gates green: typecheck 0, lint 0, 10,427 tests pass in 84s wall, build 19.5s. Scope grew on the spec session's ruling and the user's approval: the committed `anthropic` row split in two. Tested against docs only; the user has no key for either provider.
Base: c4901429
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Cloud Reasoning Dialects](../spec.md)

**What to build:** A player on Anthropic's OpenAI-compatible endpoint gets the budget slider and no dropdown, and each request carries a `thinking` object with the budget clamped under the output cap. A player on Google's OpenAI-compatible endpoint gets a budget on a 2.5 model or a level on a 3.x model, spelled inside `google.thinking_config`. Both dialects are named from the endpoint host, never from a probe.

**Rationale for the model:** two dialect rows, a host matcher, a clamp, and a generation-based mapping. Sonnet at medium effort.

## Acceptance criteria

- [x] The resolver names anthropic for Anthropic's API host, and google-2.5 or google-3 for Google's generative-language host by model id, from the endpoint URL and model alone, recording the source as identity. The generation matcher has a test per documented family; an unknown Google id is google-3.
- [x] The anthropic, google-2.5, and google-3 rows, their spellings, the Anthropic clamp under the output cap, and the google-2.5 level-to-budget mapping already exist from ticket 01. This ticket wires detection to them and asserts, through the request builder, that a resolved anthropic target sends the `thinking` object and no `reasoning_effort`, and a resolved Google target sends its `google.thinking_config`.
- [x] On an anthropic record the dropdown hides and the slider shows; on google-2.5 both show; on google-3 the dropdown shows and the slider hides.
- [x] A google-2.5 record lists levels `minimal`, `low`, `medium`, `high` only, since the documented budget mapping stops at high; a google-3 record lists the documented thinking levels only. A test proves xhigh and max are absent on google-2.5.
- [x] Resolver tests use fixed hostnames and model ids.
- [x] Live check with a user key for either provider if one exists, recording token counts in the changelog entry; otherwise the entry says tested against docs only.
- [x] Typecheck, lint, tests, and build pass; report test wall time; prove the host matcher test fails when Anthropic's host is unmatched. Update the code graph. Changelog In Progress entry, 👤 bucket, under the Native Reasoning group.

## Scope notes

Anthropic's `reasoning_effort` is documented as ignored and is never sent. Preserved thinking and tool-call thinking are out of scope.

## Comments

**2026-09-15 — built, handed over.**

Every acceptance criterion is met. The host matcher lives in [reasoningIdentity.ts](src/lib/reasoningIdentity.ts) as a row table: hostnames plus a function from model id to a capability answer. It reads the target and sends no request. `identitySource` runs first in the resolver chain in [reasoningEffort.ts](src/lib/reasoningEffort.ts) and stamps a new `identity` source on every question it answers.

**The ticket grew, and why.** Live docs read on 2026-09-15 showed ticket 01's committed `anthropic` row is broken for current Claude models. The spec session ruled the fix into this ticket and the user approved it.

- `thinking.type: enabled` returns a 400 on Claude 4.7 and later, Claude 5 included. The row split into `anthropic-budget` (Claude 4.6 and earlier) and `anthropic-adaptive` (4.7 and later, which sends `thinking.type: adaptive` and no budget).
- `budget_tokens` has a documented 1,024-token minimum. `DialectSpelling` gained `budgetMin`. A budget under it is raised; an output cap with no room for it sends no thinking object at all, which beats a request the API rejects.

**Two things the build found that the ticket did not name.**

- Claude Fable 5.1, Mythos 5.1, Fable 5 and Mythos 5 reject `thinking.type: disabled`. Those ids set `offAllowed: false`, so the switch locks on. This is the same per-model `offAllowed` hook ticket 04 needs for Kimi.
- `anthropic-adaptive` is the first dialect that takes neither a level nor a budget, and the prompt Options field had no shape for that. It fell back to the level dropdown under a heading reading "Reasoning Budget", offering a strength the wire guard drops. `ReasoningSwitch` now takes a null strength and the switch stands alone. A settings test covers it.

**Judgment calls worth a second opinion.**

- Gemini 3 levels are `low`, `medium`, `high`. The OpenAI compatibility page lists `minimal` for Gemini 3 Flash, but the per-model thinking table gives it only to `gemini-3.6-flash` and `gemini-3.5-flash-lite`. The levels both pages agree on are offered, because a missing rung costs a player nothing and a rejected one fails the turn.
- Models older than their vendor's first thinking generation are ruled out rather than named a dialect: Gemini 2.0 and 1.x, and Claude 3.5 and earlier. The ticket says an unknown Google id is `google-3`, and it still is; a *recognized* older family is a different case, and naming it `google-3` would send a thinking level it rejects.

**Open item.** Anthropic's adaptive models steer depth with `output_config: {effort: ...}`, but the OpenAI compatibility page documents only `thinking` in `extra_body` and never `output_config`, so passthrough is unverified. Nothing sends it. Worth one live request if a key ever appears.

**Live check.** None. The user has no Anthropic or Google key, so the changelog entry says tested against docs only and records no token counts.

**Red proofs.** Unmatching Anthropic's host turns 28 tests red across the two identity suites, green when restored. Adding `xhigh` and `max` to the google-2.5 ladder turns the ladder test red.

**Sequencing.** Tickets 02, 04 and 05 ran in the same working tree. Work was held and re-applied so no session committed another's files; the shared host-matcher table was agreed with 04, which adds the Moonshot rows on top of this commit.

**2026-09-15 — reviewed on both axes, findings folded in.**

Standards found eight, spec found four. All applied.

Two were real defects, not tidying:

- **The Google generation test was equality, not a range.** `generation === 205` sent any later 2.x, such as a `gemini-2.6`, to the `google-3` row and so to a `thinking_level` it does not take. That is the exact failure the row already guarded below 2.5. Both generations are ranges now, matching how the Anthropic row was already written. Two tests cover a 2.x above 2.5, and reverting the range turns them red.
- **The always-thinking match needed a trailing hyphen to fire**, so a bare `claude-fable` id would have allowed off. The line is matched as a whole name segment now, and a test covers both the bare id and a longer word that merely starts with those letters.

The spec axis also found the strongest gap: **nothing joined the identity answer to the wire body.** The identity suite tested the answers, and the request-spec suite tested hand-written records, so a wrong `budget` or `levels` in an identity row was invisible to both. `reasoningEffort.identity.test.ts` now carries five cases that resolve one real endpoint and model and assert the whole reasoning slice of the built body. Flipping the `anthropic-budget` row's budget answer to false turns one red, which neither suite caught before.

Smaller fixes: `ReasoningWrite.engaged` became `eligible`, since `off: true` implied `engaged: true` and read as a contradiction at the consumer, and its shared subexpression is computed once; the two generation helpers merged into one taking a pattern; `identitySource` is `async` like its four siblings; the nested ternary in `ReasoningSwitch` became two guarded blocks; a `GOOGLE_25_LEVELS` docstring described a budget when the constant holds levels; a `%%` escape sat in a plain `it` title; and one over-long line wrapped.

One changelog fix worth naming: ticket 01's own In-Progress entry still listed `anthropic` among the dialect rows. Both entries ship in the same unreleased section, so the release notes would have named a dialect that never existed. It now reads `anthropic-budget` and `anthropic-adaptive`.

Gates after the fold-in: typecheck 0, lint 0, 10,468 tests pass in 77s wall, build clean.

**Not fixed, and not this unit's.** `npm test` intermittently fails or reports an error from `WorldEditor.connectReferences.test.tsx`, `WorldEditor.dictionaryNavigation.test.tsx` and `FeedbackList.test.tsx` — timers and state updates firing after teardown. Each passes alone, none mentions reasoning, and ticket 05 saw the same before this work entered the tree. It predates all four tickets in this spec. Raised with the user rather than fixed here.
