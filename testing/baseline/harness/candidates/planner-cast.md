# Candidate: planner-casting (generation-side lever for the dialogue decay + soft stall)

Two surgical edits to `defaultThinkingPrompt`. Everything else is byte-identical to the shipped prompt, so the
A/B isolates the casting/momentum change. Positive contract, no prohibition list, no parrotable example values.

## Edit 1 — the Beats format line (was line 224)

BEFORE:
```
Beats: <two to four sentences of what happens this turn as the scene continues - the physical actions and, in quotation marks, the words the present characters actually speak aloud>
```

AFTER:
```
Beats: <two to four sentences of what happens this turn as the scene continues - the physical actions and, in quotation marks, a spoken line from each present character who is engaged, so the scene is carried by their voices>
```

## Edit 2 — the Beats rule (was line 232)

BEFORE:
```
- The Beats are what the world and the other characters do and say - their grounded physical reactions and the words they speak aloud, in quotation marks, consistent with the Cast above. Characters present keep speaking as the scene continues; don't reduce them to silent motion. Never write the outcome of the player's own action, their thoughts, or their next move.
```

AFTER:
```
- The Beats are what the world and the other characters do and say - their grounded physical reactions and, in quotation marks, the words they speak aloud, consistent with the Cast above. When more than one character is present and engaged, give each of them a spoken line of their own this turn, in their own voice - the scene runs on several people talking, not narration around one speaker. End the Beats on something happening - a character's action or line that carries the scene forward on its own momentum. Never write the outcome of the player's own action, their thoughts, or their next move.
```

## Why these two

- The stalled plans obeyed "list everyone" (Cast had Maya + Sarah + Rebecca) but still gave a spoken line to
  only Maya. The narrator renders the plan near-verbatim, so silent-in-plan = silent-on-page. Edit 1 moves the
  dialogue requirement from "the present characters speak" (which the model satisfies with one speaker) to
  "a line from each engaged character."
- The soft stall ("...as she waits for your response", the "gradual means" loop) is the plan ending on a
  hand-back. Edit 2's "end on something happening / on its own momentum" gives the narrator a forward beat to
  render instead of a wait.

## How it will be A/B'd (two-stage replay — the plan feeds the narrator)

In staged mode the plan rides in the narration's final user message (after the `Rough notes on what happens
this turn` marker). So the faithful test is:

1. Re-fire the PLANNER on the recorded thinking messages, `--rerender` splicing the candidate template onto the
   real recap/entities → a fresh plan.
2. Splice that fresh plan into the narration's final user message (replace the text after the marker).
3. Fire narration, score dialogue-share / distinct-speakers / handback + the guardrails (freeze, fact-retention).

A = recorded plan → narration (shipped). B = cast-plan → narration (candidate). Same stalled session, same
turns 6-15. B wins only if dialogue & speakers UP, handback DOWN, and freeze + fact-retention flat.
