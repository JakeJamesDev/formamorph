# 06: Refresh Rampage

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q1, Q3, Q4, Q6, Q8; Feature assignment)

## What to build

**City Rampage** plays better on the cloud model and shows its assigned features, with its premise kept: title, hook, and core cast.

- **Assigned features:** A script drives Alert Level (move the legacy `code` into scripts). A stat toggle covers Berserk.
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

**What changed.**

- **Alert Level.** Its After the AI script now has named sections and comments. It weighs damage 70/30 over fury and never goes down (`Math.max` with the previous value). The old 60/40 weights reached the last tier (Aegis-One) at 60% Destruction with full Rampage; now the last tier needs most of the city down.
- **Berserk (stat toggle).** New creature stat **Berserk**, `enabled: false`. **Berserk State** (player toggle) switches it on through `statToggles` and lost its old regen rows. The stat's After the AI script sinks a quarter deeper each turn, adds 5–15 Rampage, and takes 4–10% of max Health. The trait's When a Trait Switches script clears Berserk when a frenzy starts.
- **Traits.** **Body** is now **Presentation**, and **Type** is a root group (it was nested under Body). Every type and mutation has new text.
- **Placeholders (Q17).** `origin`, `codename` and `weakness` are now **Origin**, **Military Codename** and **Secret Weakness**.
- **Content.** New system prompt (tone line, director role, eight rules, the per-turn hook last), readme (play part first, then "How this world is built", per the spec-session ruling), intro readme with trait guidance, two new narration openings (harbor at sunset, Vasquez on the loudspeakers), and the kept action opening (same id, new text). New entity **Police Cordon** for the first tier. The news chopper also sits at the Neonspire root. `imageTags` on Neonspire and the creature. Lorebook rewritten to positive phrasing.
- **WebP (Q14).** No image the fix converts: the two JPEGs (thumbnail, Neonspire background) are kept by design (spec-session ruling). The Test Bench row is empty.

**Tests.** `rampageWorld.test.ts`: 11 tests. A mutation script broke 14 parts of the world one at a time (the Alert ratchet, weights and fury term; the toggle, the stat's default, the player toggle, the reset and its direction; each Berserk script line). All 14 failed the suite. `bundledPlayerStats.test.ts` lists Berserk among the creature's stats. The owner-tree parity snapshot changed only its `rampage` entry.

**Probe (Q8).** Cloud `default`, worktree vs `ace2e0204`, one interleaved batch per row:

| Batch | Runs/arm | Turns | Empty | Leaks (token/reasoning/placeholder) | Choices ok | Stat ok | Flagged | Errors | Rubric new | Rubric old |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 6 | 18 + 18 | 0 | 0 / 0 / 0 | 36/36 | 36/36 | 0 | 0 | 45/60 | 41/60 |
| 2 | 8 | 24 + 24 | 0 | 0 / 0 / 0 | 48/48 | 48/48 | 1 new, 0 old | 0 | **62/80** | **55/80** |

- Rubric: transcripts re-blinded under shuffled ids, then scored 0–2 on opening, 2nd person present (choices included), world-fact fidelity, advancement, and tone and length. Batch 2 paired by run: new wins 6, loses 1, ties 1.
- The one flag is a false positive: `TONE-GORE` matched "crushed bodies of the port machinery".
- Between the batches: a positive damage line in the tone ("dust, smoke, fire, shattered glass and twisted steel"), after a "water churned red" slip, and a plainer action opening, after two 400-word first turns.
- What moved: new runs put the police cordons and the PA voice in play early and keep later tiers back. Both arms still write long, purple turns; that is the model's register on this script.

**Review fold-ins.** The per-turn hook names no specific speaker. The Giant's text lost its list of thrown objects. One lorebook line and one script comment became positive. The readme and the toggle text describe Berserk's cost in stat terms. The Berserk script writes through its own `rampage` and `health` names. The test takes one options object, shares one value helper, and covers the clamp on Rampage and Health. The probe ran before these text edits.

**Not covered.** `Alert Level` reads `entities["The Creature"]`. A test covers it under None, not under a library persona. The script predates this ticket.

**Gates.** First run all green (416 s).
