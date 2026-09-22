# Revised demonstration: less reasoning, unchanged retrieval coverage

**The revised example did not establish reliable background retrieval.** It reduced total reasoning in this small batch, particularly on the later cobbler turns, while adding unfetched background entities during both quiet turns.

[Narration only](selection-chain-outputs.md) · [Thinking only](selection-chain-thinking.md) · [Exact prompts](selection-chain-prompt.md) · [Protocol](selection-chain-protocol.md) · [Scoring](selection-chain-review.json) · [Complete request/response evidence](selection-chain-evidence.json)

## Comparison

A is the existing concise archivist example. B demonstrates selecting the archivist and a background moth, retrieving both, and applying their details while leaving an unused courier unfetched. Both examples remain in context from the first request onward.

Two seeds × three consecutive actions × two arms: **12 fresh player turns, 20 model requests, 236.4 seconds**. No retries, truncations, or timeouts. The loaded model metadata matched the preceding MeroMero experiment. All real tool traces and reasoning are discarded between player turns; previous narration remains.

| Measure | A: existing | B: revised |
|---|---:|---:|
| Completed turns | 6/6 | 6/6 |
| Correct healer/cobbler retrieval | 4/4 | 4/4 |
| All explicitly appearing entities fetched this turn | 4/6 | 4/6 |
| Missed entity appearances, unique per turn | 3 | 4 |
| Lookups / unused lookups | 4 / 0 | 4 / 0 |
| Reasoning before lookup | 838 tokens | 687 tokens |
| Reasoning after lookup | 970 tokens | 734 tokens |
| Reasoning on turns without lookup | 394 tokens | 330 tokens |
| Total reasoning | 2,202 tokens | 1,751 tokens |
| Average narration length | 153 words | 164.2 words |

Reasoning tokens are reported by the server, not estimated. B reduces the total by **20.5%**, but only two seeds and one action sequence were tested. Later turns have different narration histories. This is a package comparison, not an isolated test of example length or one phrase.

## What the thinking actually does

- **First healer, seed 424243:** Both arms inventory the cast to identify Mara. That is useful selection, although both continue planning before retrieval. A then repeats the action, inventories player state, outlines the approach, and gives a prose summary of that same outline. B applies boiled-water/linen facts and gives one shorter action sequence. Post-lookup reasoning: **343 → 144 tokens**.
- **Second healer, seed 424244:** B explicitly considers retrieving Bram and possibly Odette, then settles on Mara. Its final narration contains only Mara, so this selection is valid. After retrieval, however, B inventories the whole cast again, repeats the approach twice, and deliberates about names. A applies the treatment facts much more directly. Post-lookup reasoning: **119 → 344 tokens**. This is a real regression hidden by the aggregate improvement.
- **First cobbler, seed 424243:** A interprets the action and footsore condition usefully, then outlines the approach twice before lookup. Afterward it applies the inspection-before-price rule but repeats the approach again. B still inventories candidates, but postpones most scene development until it has Iven’s entry, then uses his inspection rule. Before/after reasoning: **340/230 → 151/119 tokens**.
- **Second cobbler, seed 424244:** A selects Iven faster, but after retrieval debates whether his name may appear and repeats the scene sequence. B takes slightly longer to list candidates, then gives a compact account of the returned traits and player fatigue. Before/after reasoning: **106/278 → 136/127 tokens**.

No duplicate lookups or full player-facing prose drafts appeared. Restating the task did not disappear. The useful distinction is how much new work follows that restatement: applying inspection/treatment facts versus repeating selection or staging already settled.

## Background inclusion remains the gap

| Seed and turn | A: missed appearances | B: missed appearances |
|---|---|---|
| 424243, healer | Cobbler and basketmaker during the opening scan | None |
| 424243, quiet observation | “the woman” refers back to Mara | Rope Ferry |
| 424244, quiet observation | None | Cobbler, basketmaker, and woman with linen (Mara) |

The revised quiet-turn thinking is especially informative:

> I'll also include a small human moment or an observational detail about the other characters present at the landing to keep the scene alive.

It then narrates three characters without calling the tool. In the other quiet turn, it explicitly plans to mention the ferry but also skips retrieval. These are planned inclusions, not merely details that appeared unexpectedly while writing.

This is **consistent with** the background detail in our demonstration encouraging background narration more reliably than its retrieval procedure. It does not prove that mechanism: the demonstration also changes length and content, and the earlier story differs between arms.

The per-turn policy matters: knowing Mara from the preceding narration does not satisfy a fresh lookup. Both arms miss that case at least once. Generic “other travelers” is additionally ambiguous in B’s first quiet turn; the explicit ferry miss already fails that turn, so counting the group more conservatively does not change the 4/6 result.

## Narration and factual review

No demonstration names or distinctive atlas/moth details leaked into the real scene. Retrieved healer/cobbler descriptions were used; no clear fixed entity-fact contradiction was identified. Added atmospheric details are not automatically contradictions.

There are subjective quality issues worth reading: A’s second healer describes her eyes catching the clasp at her own throat, an awkward viewpoint detail. B’s first quiet turn describes several ferry lines despite the full entry specifying a single guide rope; since no lookup occurred, the model lacked that entry. These reinforce why output quality and retrieval coverage need separate review.

## Decision

Keep this as a mixed experiment, not a new preferred prompt. It gives evidence that we can reduce some redundant planning with a demonstration, but it does not yet teach “every entity I put in the narration needs retrieval.”

The next useful isolated comparison would preserve the same demonstration narration and tool results while changing only the selection language that binds every planned appearance to a lookup. That would avoid giving one arm extra background prose to imitate. No further inference or production prompt change is included here.

## Verification

- Focused tests: **58 passed, 5.02 seconds**. Shared loop coverage: **97.06% statements, 89.79% branches, 100% functions**; demonstration module: **100%**.
- Removing story-history insertion made the new two-turn test fail; original bytes restored (**2.36 seconds**).
- Full suite: **12,563 passed, 3 skipped, exit 0; 101.35 seconds**. It uses parallel workers, so summed test timings exceed wall time; no post-test hang appeared.
- App and harness typechecks passed. Lint: zero errors, one existing Fast Refresh warning. Build passed in **22.85 seconds**, with its large-chunk warning. Graph refresh completed with exit 0.
- Actual request evidence verifies exactly one example per request, correct prior narration, and no retained real reasoning. Original response fields and all final narration are preserved separately for review.
