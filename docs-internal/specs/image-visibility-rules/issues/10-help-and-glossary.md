# 10: Help topic and glossary

Status: done
Blocked by: 07, 08
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Rationale: documentation over finished behavior. Wiki page, help lines, glossary entries, no logic.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

The help window answers "how do I show a portrait only when hurt" and "can a trait need a stat" (Q17).

- A wiki section on **Visibility rules**: what they are, the "Shown while" sentence, author order as priority, slot 0 as the cover outside play, Not, bearers. A route line to the gallery cog.
- The trait gates page gains **stat Conditions**: six operators, raw vs `%`, the once-per-turn settle, hand switch-off stays off.
- `CONTEXT.md` glossary: **Visibility rule** (image), **stat Condition**, with "image condition", "image gate" and "hide rule" under Avoid.
- The help search covers the new sections (fuzzy and semantic indexes rebuilt where the project rebuilds them).

## Acceptance criteria

- [ ] Wiki pages added or updated with human formatting; no reference to agent files.
- [ ] Surface map and route lines point at the gallery cog and the Availability tab.
- [ ] Glossary entries added; the copy sweep finds no stray term.
- [ ] Help search returns the Visibility rules section for "show image when hurt" (one probe, numbers in the comments).
- [ ] Changelog fragment written. Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments

- Help search probe, 2026-10-12, bundled index and rebuilt `sectionVectors.json` (542 sections):
  - "show image when hurt": keyword rank 1 (`World-Editor-Entities#visibility-rules`); semantic rank 2, score 0.352 against 0.396 for the top hit.
  - "how do I show a portrait only when hurt": keyword rank 1; semantic rank 2, 0.344.
  - "can a trait need a stat": keyword rank 1 (`World-Editor-Traits#stat-conditions`); semantic misses the top five.
- Route lines: the cog sits on the entity panel's Profile tab, which is no Take Me There target, so the Visibility rules section routes to `worldEditorEntity.profile`. The stat Conditions section routes to `worldEditorTrait.availability`.
