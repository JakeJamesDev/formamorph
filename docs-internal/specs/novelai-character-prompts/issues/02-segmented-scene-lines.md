# 02: Segmented Scene Lines

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: a pure composer change, but per-part normalize and dedupe has a quiet failure mode (a shared tag dropped from one character) that the tests must catch.

## What to build

On a NovelAI V4+ image preset, the scene tag line for a scene image is written as `<counts>, <action>, <place> | <kind>, <character 1 tags> | <kind>, <character 2 tags>`. Counts stay group counts (`2girls`, `1girl, 1boy`); each character part leads with `girl`, `boy` or `other` and drops that character's own count and `solo` tags. Scenes with one character split the same way. The line is normalized and deduped per part, so a tag both characters share stays in both, and **Clean Up Tags** on never eats the separators. The player sees and edits this line under the image, and the draw sends it through ticket 01's split. Every other provider composes exactly as today.

Spec: stories 1–4, 6–9, 11–14, 20, 22–24; decisions on segmented composition, layout, per-part normalize, and who asks for the segmented form.

## Acceptance criteria

- [ ] The scene tag composer takes one new input for the segmented form; without it, output is unchanged (existing tests pass as written).
- [ ] Two characters: counts in the base, `girl`/`boy` kinds leading their parts, cast order kept (persona first when in frame).
- [ ] One character is still split.
- [ ] A tag shared by both characters appears in both parts.
- [ ] **Clean Up Tags** on keeps ` | `; off keeps NovelAI syntax inside a part.
- [ ] An untagged character gets a kind-only part.
- [ ] `no humans` still drops with a cast; names and places are still stripped from the action tags.
- [ ] The in-game scene tag run asks for the segmented form only when the active image preset is NovelAI V4+, through ticket 01's predicate.
- [ ] Tests at the composer seam; each guard proven by reinstating its bug.
- [ ] Changelog fragment: one 👤 Added entry for NovelAI scene images keeping characters apart.
- [ ] Four gates green.
