# 04: Moonshot

Status: ready-for-human
Status note: Built and committed. Four gates green: typecheck 0, lint 0, 10,476 tests in 73.9s, build 16.9s. Reviewed on both axes; findings folded in. Tested against Moonshot's published docs only, with no live key.
Base: c4901429
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

**Parent:** [Cloud Reasoning Dialects](../spec.md)

**What to build:** A player on Kimi gets controls that match the model. On k3 the dropdown lists Low, High, and Max and the switch locks, since k3 always reasons. On k2.6 the switch sends `thinking.type: disabled` and there is no dropdown. On k2-thinking and k2.7-code the switch locks and no off field is sent. Non-reasoning k2 models show no controls.

**Rationale for the model:** two dialect rows and a model-id matcher on one host. Sonnet at medium effort.

## Acceptance criteria

- [x] The resolver names moonshot-k3 or moonshot-k2 from Moonshot's API host plus the model id, recording the source as identity: k3 and kimi-latest are k3; k2.6, k2.7-code, and k2-thinking are k2; k2 and k2-0905 are non-reasoning.
- [x] moonshot-k3 lists levels `low`, `high`, `max` only, sends `reasoning_effort`, rejects off, and sends no budget.
- [x] moonshot-k2 sends `thinking: { type: "disabled" }` for off on k2.6, sends no off field on k2-thinking and k2.7-code, and sends no effort or budget.
- [x] The dropdown on k3 lists exactly the three levels, with the current pick kept as today; the switch is checked and disabled on every mandatory Kimi model.
- [x] Request-spec tests cover k3 effort, k3 off attempt, k2.6 off, k2-thinking off attempt. Resolver tests use fixed host and model ids.
- [x] Live check with a user Moonshot key if one exists; otherwise the changelog entry says tested against docs only.
- [x] Typecheck, lint, tests, and build pass; report test wall time; prove the k3 ladder test fails when `medium` is allowed. Update the code graph. Changelog In Progress entry, 👤 bucket, under the Native Reasoning group.

## Scope notes

Preserved thinking (`thinking.keep`) is not sent. Kimi through OpenRouter is ticket 02's concern.

## Comments

**2026-09-15 — built, reviewed, handed over.**

Every acceptance criterion is met except the live check, which needs a Moonshot key nobody here has. The changelog entry says tested against docs only.

The row lives in `src/lib/reasoningIdentity.ts`, the shared host matcher ticket 03 built. Moonshot is the only first-party row whose model id decides both the dialect and the off answer, so it is also the only one that sets `offAllowed` per model on more than an exception basis. k3 needs no `offAllowed` at all: its dialect row already refuses off, and answering twice would let the two disagree.

**The model list is not what the ticket assumed.** Read live from Moonshot's own model list on 2026-09-15, after the review flagged the first of these:

- The dated builds are `kimi-k2-0905-preview` and `kimi-k2-0711-preview`, not the bare `k2-0905` the ticket names. There is also `kimi-k2-turbo-preview`. The first pattern matched none of them, so all three would have fallen through to the probe chain.
- `moonshot-v1-*` is still served by this host and has no thinking parameter. It is now ruled out, matching how the Anthropic and Google rows treat their own pre-thinking generations.
- `kimi-k2-thinking` is marked deprecated, as is `kimi-latest`. Both rows are kept, since the ticket names them and a deprecated id still resolves.

**Two ids left deliberately unclaimed**, both of which fall through to the rest of the chain, which is today's behavior and costs nothing:

- `kimi-k2.5`, deprecated, which almost certainly takes k2.6's spelling but is not named in the ticket.
- `kimi-thinking-preview`, which reasons but whose spelling is unverified. Guessing it would risk sending a field it refuses.

**Review findings folded in.** Both axes flagged that the k3 test was `includes('k3')`, a substring match that would claim any future id carrying those characters; it is `startsWith('kimi-k3')` now. The standards axis also found the `moonshot-v1` gap and a settings-test helper whose hand-written `sources` diverged from what the resolver actually stamps; the helper now says plainly that no control reads them and the resolver test is what pins them.

**Guards proved by reinstating each bug.** Adding `medium` to the k3 ladder turns three tests red, including the dropdown case a player would notice. Reverting the two id fixes turns seven red, exactly the dated-preview and `moonshot-v1` cases.

**Changelog note.** The entry is correct in the tree but landed in sibling commit `ff8e12a6` rather than this one, swept along while four sessions committed in turn. Per the tracker protocol a misplaced changelog line is never a reason to rewrite history, so it was left.
