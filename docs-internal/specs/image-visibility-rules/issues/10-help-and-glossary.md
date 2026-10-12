# 10: Help topic and glossary

Status: ready-for-agent
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
