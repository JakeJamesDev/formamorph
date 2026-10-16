# 05: Refresh Open Chat

Status: ready-for-agent
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

- [ ] The world's row is in the shared coverage table and passes.
- [ ] The shared suite passes for this world, including the old-save check.
- [ ] Per-world tests cover each script's effect on its stat and each gate that must hold.
- [ ] The probe (01) shows no structural regression and a rubric win over the pre-refresh revision, with 5 or more runs per arm. Numbers go in this ticket's comments.
- [ ] Fingerprints are regenerated. No changelog edit.
- [ ] Four gates are green. The stripped diff is ready for review.
