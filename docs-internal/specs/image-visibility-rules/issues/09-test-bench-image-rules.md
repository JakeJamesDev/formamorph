# 09: Test Bench for image rules

Status: done
Blocked by: 05, 06
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: two rules on the pure rules seam, reusing the resolution helpers ticket 05 touched.

Parent: [Image Visibility Rules spec](../spec.md)

## What to build

Test Bench catches an image that can never show, or a gallery that can go blank (Q12).

- `image-rule-missing-target`: an image rule names a trait, group or stat no bearer has.
- `entity-images-all-hideable`: every image carries a rule, and no pair of images forms `X` / `not X` on the same single Condition.
- Rule copy names the entity and the image position ("Ash, image 2").

## Acceptance criteria

- [ ] Each rule fires on a minimal world and stays silent on its clean twin.
- [ ] All-hideable stays silent when one image has no rule, and when two images form `X` / `not X`.
- [ ] Missing-target fires for a trait, a group and a stat, each.
- [ ] Changelog fragment written. Gates green: `typecheck`, `lint`, `test`, `build`.

## Comments
