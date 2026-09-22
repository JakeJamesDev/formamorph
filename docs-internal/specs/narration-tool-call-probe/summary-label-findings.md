# Entity labels: description versus summary

**Changing only the label produced some retrieval, but did not make it reliable.** All twelve narrations completed. Three of the eight cases requiring new lore fetched all needed entries, compared with none in the saved minimal-prompt baseline.

[Read every narration pair](summary-label-outputs.md) · [Thinking and tool calls](summary-label-thinking.md) · [Exact candidate prompt](summary-label-prompt.md) · [Protocol](summary-label-protocol.md)

Both arms use the minimal narrator instruction. “Description labels” is the saved baseline; “Summary labels” changes just the three entity field labels. This is not a comparison with the earlier verbose prompt.

## Results

| Metric | Description labels | Summary labels |
|---|---:|---:|
| Completed narrations | 12/12 | 12/12 |
| Cases needing new lore that retrieved all of it | 0/8 | 3/8 |
| Newly required individual entries retrieved | 0/10 | 4/10 |
| New lookup calls | 0 | 4 |
| Cached-Bram controls with no repeat lookup | 2/2 | 2/2 |
| Silent-observation controls with no lookup | 2/2 | 2/2 |
| Reasoning tokens | 3,031 | 4,317 |
| Average narration words | 211.5 | 201.4 |
| Batch time | 198.879 s | 264.636 s |

The four candidate calls were for needed, uncached entries. Known Bram entries count as already available, not as missed lookups. Reasoning totals include the extra tool rounds; they do not isolate a change in thinking efficiency. Word counts split on whitespace.

| Case | Run 1: new lookups | Run 2: new lookups |
|---|---|---|
| Greet both people | Bram, Odette | None |
| Inspect Odette and ask about eels | None | Odette |
| Inspect ferry | None | None |
| Quiet observation | None | None |
| Ask Bram, his lore cached | None needed | None needed |
| Greet both, Bram cached | None; Odette missed | Odette |

## What changed, and what did not

- **The label was worth testing on its own.** Retrieval appeared with no added instruction and no tool-description change. Three successes in this small batch are evidence of a possible improvement, not a stable success-rate estimate.
- **Retrieval remains optional in the model's recorded planning.** It sometimes recognizes that a summary lacks detail and fetches the full entry; elsewhere it explicitly treats the summary as enough to improvise. The second greeting skips lookup despite recognizing the entries as summaries.
- **Fetching helps preserve specific facts.** In the second Odette case, the narration uses the retrieved right-cheek burn scar and green glass hair bead. In the first, without retrieval, it invents a left-cheek scar and different hair details.
- **No lookup in a quiet scene is not sufficient evidence of restraint.** The second quiet-observation narration adds detailed character portrayals and gives Bram a missing right arm, contrary to the full entry's pinned left sleeve. Neither character entry was loaded. This is outside the fixed action-required retrieval count above, but matters to overall canon fidelity.
- **Engagement remains for subjective review.** All 24 before/after narrations are available unedited. The candidate still adds some unrequested player actions, such as tying a knot, and the average length stays near the baseline. No stylistic verdict is implied by that average.

The same model, seeds, tool description, thinking setting, limits, context values, and cached tool history were retained. Before inference, all twelve prepared requests were checked against the saved baseline, with exactly three entity-label substitutions allowed. Loaded model metadata matched. No model retries or cap increases were used. This experiment does not establish cross-model behavior, nor prove the label alone can satisfy the retrieval requirement.

## Evidence

- Model: `g4-meromero-v2-31b-i1` on the existing LM Studio endpoint.
- [Raw baseline](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-role-only-batch-2026-09-22T15-41-43-120Z.json).
- [Raw candidate](D:/Documents/GitHub/formamorph/testing/baseline/runs/narration-tool-call-probe/experimental-summary-label-batch-2026-09-22T18-52-46-286Z.json).
- Review documents were checked against all 24 final narrations and 27 thinking responses. Application prompts were not changed.

## Harness verification

- All twelve actual initial requests matched the prepared candidates. Required-entry counts exclude already-cached lore.
- Focused suite: 44 passed in 5.287 seconds; shared probe coverage 96.8% statements/lines, 87.25% branches, 100% functions. Disabling the label change caused the new test to fail at the intended assertion in 2.297 seconds; source restoration was verified.
- Application typecheck passed in 16.075 seconds; harness typecheck passed in 2.296 seconds. Lint passed in 14.056 seconds after correcting a regex-spacing lint error; the existing Fast Refresh warning remains.
- The sandboxed full suite had 12,546 passes, three failures, and three skips in 96.868 seconds. All three failures were `spawnSync node EPERM` in changelog extraction tests. That file passed outside the sandbox (14 tests, 1.705 seconds), then the full suite passed there: **12,549 passed, three skipped, exit 0, 90.038 seconds**.
- Build passed in 17.443 seconds with the existing bundle-size warning. Graph refresh completed in 118.360 seconds. The full suite also clears the earlier role-only experiment's outstanding gate.
- Changelog updated. Application prompt defaults, export shapes, and version are untouched.
