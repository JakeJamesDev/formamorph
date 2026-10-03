# 09: Reasoning and the Thinking block

Status: done
Base: 80b99256
Blocked by: 02, 05, 08
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player with a reasoning model lets it think about a help question, and reads the reasoning on the answer (Q5, Q16, Q20, Q28).

**General tab.** A **Reasoning** row with the shared reasoning field from ticket 02, default Off. Its effort list and its budget come from the resolved answer endpoint.

**The help session.**

- The answer request reads the help reasoning setting. The rule that forces reasoning off for every editor request kind no longer covers it.
- The pick request stays at reasoning off.
- Lookup mode still needs an endpoint that takes function calls; the reasoning setting does not change that check.
- The reasoning text reaches the window with the answer events. Reasoning that a model writes inline is still removed from the answer text.

**The Thinking block.**

- An answer with reasoning text shows a Thinking block above the answer text.
- It follows the Sources rule from ticket 08, with its own stored default. The first default is closed.
- Ticket 08 built that rule as one reusable hook (`useFoldRule`) and stores the Sources default as a field of the help settings value. Reuse the hook, and add the Thinking default as a second field of that value and its codec (Q53). No separate storage key.
- An answer takes the default when its first reasoning text arrives.
- While the model reasons and no answer text exists, the waiting line stays.

The General docs section gains the row.

Recommended model rationale: a change to the reasoning resolver that every request passes through, plus a streamed block in the window.

## Acceptance criteria

- [ ] With an effort set, the answer request carries it in the form the endpoint's dialect takes; the pick request carries reasoning off.
- [ ] With Off, the request bodies equal those of ticket 05.
- [ ] The other editor request kinds still send reasoning off (a guard test, proven by removing the rule).
- [ ] The Thinking block shows the reasoning text, starts closed, and follows its own default apart from Sources.
- [ ] An endpoint with no reasoning support shows the field in its unavailable state.
- [ ] A changelog line is in In Progress.
- [ ] The four gates are green.
