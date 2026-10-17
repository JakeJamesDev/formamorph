# 05: Refresh Open Chat

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q1, Q3, Q4, Q6, Q8; Feature assignment)

## What to build

**Open Chat** plays better on the cloud model and shows its assigned features, with its premise kept: title, hook, and core cast.

- **Assigned features:** Stays a blank stage that the library entity leads. No assigned features beyond the common set. The content pass targets the system prompt, openings, and traits.
- **Common to every world:** `openings`, `imageTags` on every location and entity, `introReadme` for trait guidance, `readme` for play only.
- **Content pass:** rework the system prompt, lore, entities, locations, and pacing to the prompt-writing guide. Add, rewrite, or cut freely within the premise. No new art.
- Follow the `bundled-worlds` skill: read stripped copies, edit by script, preserve ids and images, validate references.

## Acceptance criteria

- [x] (Follow-up) Every script uses full variable names (no one-character names), is split into explained sections, and comments each section's logic (Q16). (Not applicable: Open Chat has no scripts.)
- [x] (Follow-up) Every placeholder name is in title case with spaces, like a proper noun (Q17).
- [x] The world's row is in the shared coverage table and passes.
- [x] The shared suite passes for this world, including the old-save check.
- [x] Per-world tests cover each script's effect on its stat and each gate that must hold. (Not applicable: Open Chat has no scripts or gates. The world test now also checks the location's `imageTags`.)
- [x] The probe (01) shows no structural regression and a rubric win over the pre-refresh revision, with 5 or more runs per arm. Numbers go in this ticket's comments.
- [x] Existing art is re-encoded to WebP through the app's fix (Q14), and the world's Test Bench row holds only its `location-no-entities` finding (Q15). (The thumbnail is already WebP.)
- [x] Fingerprints are regenerated. No changelog edit.
- [x] Four gates are green. The stripped diff is ready for review.

## Comments

**Spec-session rulings (2026-10-16).** Keep one opening; the library entity's openings replace the world pool (story 23). No dictionary entry and no entity.

**What changed.** The Plain voice block (the default Style), the world's one-line system prompt, the location's AI description, and `imageTags` on the location. Chat and Literary stay as their own probes left them: the world probe plays default picks only, so it has no evidence for them.

**Baseline faults (old world, Plain, cloud, 6 runs).** Narration in past tense on 12 of 16 turns, no reply opened on the entity's answer (0 of 16), and "the player" in the narration on 2 turns.

**Drafts (4 runs per arm each, worktree vs `ace2e0204`).** Past-tense turns / speech-first turns, new vs old:

| Draft | Change | New | Old |
|---|---|---|---|
| 1 | Present-tense line, "you" line, one short action line between spoken lines | 0/10 · 5/10 | 4/9 · 0/9 |
| 2 | Tense moved into the lead sentence; paragraph shape rule | 6/10 · 7/10 | 9/11 · 0/11 |
| 3 | Tense back on its own line | 4/11 · 9/11 | 12/12 · 0/12 |
| 4 | Tense rule last, with a `<name> says` shape | 0/10 · 8/10 | 5/9 · 0/9 |

Draft 4 shipped. The tense rule held only in the last slot.

**Final batch, cloud `default`, worktree vs `ace2e0204`, 6 runs per arm, one batch, arms interleaved:**

| Arm | Turns | Empty | Token leaks | Reasoning leaks | Placeholders | Choices ok | Flagged | Errors |
|---|---|---|---|---|---|---|---|---|
| worktree | 18 | 0 | 0 | 0 | 0 | 18/18 | 2 | 0 |
| ace2e0204 | 18 | 0 | 0 | 0 | 0 | 18/18 | 2 | 0 |

No structural regression. Rubric, per narrated turn (Maren's own greeting drew page one on 5 new and 2 old runs, so those turns have no narration):

| Item | worktree | ace2e0204 |
|---|---|---|
| Present tense (Plain contract) | 13/13 | 4/16 |
| Player addressed as "you", never "the player" | 12/13 | 13/16 |
| Reply opens on the entity's spoken answer | 9/13 | 0/16 |
| All three | 9/13 | 0/16 |
| Length in the Medium band (4 to 8 sentences) | 11/13 | 15/16 |
| Quoted speech share of the reply | 43% | 21% |

These counts are by script and not blind (the key was read first).

**Blind rubric score (same batch).** A separate scorer read only the transcripts, never the key. It graded each narrated turn on the baseline rubric items that apply to a chat world (1 ending, 2 person and tense, 3 prose format, 5 card fidelity, 12 advancement) plus the Plain opener:

| Arm | Narrated turns | Score | Per turn (of 6) |
|---|---|---|---|
| worktree | 13 | 63.5 / 78 (81%) | 4.9 |
| ace2e0204 | 16 | 56 / 96 (58%) | 3.5 |

Rubric win. The new arm loses ground on item 1 (12.5/13 vs 15.5/16) and card fidelity (11/13 vs 13.5/16). The Medium band slipped (two new turns ran 3 sentences; mean 7.2 to 4.7 sentences); the paragraph-shape line likely pulls against the Medium length. The `<name> says, <name> looks` shape cue was not copied: "<name> looks" appears once in 13 new turns, "says" after a name twice (old arm: 0 and 1).

**Left unchanged on purpose.** The opening values (the lead's greeting drew page one on most runs, so the world opening had little to judge), both readmes (already setup-only and play-only), and the Reply Length and Pacing values (no fault seen). Not fixed: the Plain paragraph shape (one spoken line per paragraph) holds on few turns, and Maren's greeting brings its asterisk actions into later replies, as the earlier Open Chat probes found.
