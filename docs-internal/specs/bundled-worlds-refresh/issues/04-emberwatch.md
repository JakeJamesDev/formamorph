# 04: Refresh Emberwatch

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q1, Q3, Q4, Q6, Q8; Feature assignment)

## What to build

**Emberwatch** plays better on the cloud model and shows its assigned features, with its premise kept: title, hook, and core cast.

- **Assigned features:** Keeps blueprints and gates. Adds a lorebook for the keep, the barrow, and the factions (Q9). Adds `imageTags` on every location and entity.
- **Common to every world:** `openings`, `imageTags` on every location and entity, `introReadme` for trait guidance, `readme` for play only.
- **Content pass:** rework the system prompt, lore, entities, locations, and pacing to the prompt-writing guide. Add, rewrite, or cut freely within the premise. No new art.
- Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and images, validate references.

## Acceptance criteria

- [x] The world's row is in the shared coverage table and passes.
- [x] The shared suite passes for this world, including the old-save check.
- [x] Every script uses full variable names (no one-character names), is split into explained sections, and comments each section's logic (Q16).
- [x] Every placeholder name is in title case with spaces, like a proper noun (Q17).
- [x] Per-world tests cover each script's effect on its stat and each gate that must hold.
- [x] The probe (01) shows no structural regression and a rubric win over the pre-refresh revision, with 5 or more runs per arm. Numbers go in this ticket's comments.
- [x] Existing art is re-encoded to WebP through the app's fix (Q14), and the world's Test Bench row in the shared suite is empty.
- [x] Fingerprints are regenerated. No changelog edit.
- [x] Four gates are green. The stripped diff is ready for review.

## Comments

**Probe evidence (Q8), 2026-10-16, on the landed text.** Cloud default endpoint, arms `worktree` vs `ace2e0204`, interleaved in one batch, 8 runs per arm.

| Arm | Runs | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Stat ok | Flagged | Errors |
|---|---|---|---|---|---|---|---|---|---|---|
| worktree | 8 | 24 | 0 | 0 | 0 | 0 | 24/24 | 24/24 | 0 | 0 |
| ace2e0204 | 8 | 24 | 0 | 0 | 0 | 0 | 24/24 | 24/24 | 0 | 0 |

- **Structure:** no metric is worse on the new arm.
- **Rubric:** transcripts re-blinded under shuffled ids (the probe's A/B labels are fixed per world), then scored 0–2 on five baseline-rubric items: opening turn, 2nd person present, world-fact fidelity, advancement, and the barrow's menace shown. New **64/80** vs old **57/80**. Paired by run: new wins 6, loses 2.
- **What moved:** the new arm uses the authored places and signs (the Captain's Hall, the mound ring, the heath, the barrow dead, the gate sealed at dark). An invented seacoast shows in 2 of 8 new runs vs 5 of 8 old.

**How the text got there.** Four batches, each with its own control:

| Batch | Runs/arm | New | Old | Change before the next batch |
|---|---|---|---|---|
| 1 | 6 | 43/60 | 44/60 | Inland geography, a per-turn hook line, the split mound in the watchtower view, a plainer action opening |
| 2 | 8 | 65/80 | 58/80 | Review fold-ins: the geography line lost its "coast" negative, narrower lore keys, literal readme copy |
| 3 | 6 | — | — | Structure failed: 2 flagged turns vs 0. Both were the generated first turn after the action opening inventing a smell of blood in the keep. The keep's AI description now names its smells. |
| 4 | 8 | 64/80 | 57/80 | Landed text |

**Gate finding.** `GameViewer.bundledSaves.test.tsx` failed about 4 runs in 10 on Emberwatch, on base content too (ticket 03 saw it). The test took the first save in the store, which can be the autosave an authored page one writes, and the played turn's autosave then replaced it before the load. The test now waits for the save that holds the played turn: 20 of 20 runs passed after the fix. No app code changed.
