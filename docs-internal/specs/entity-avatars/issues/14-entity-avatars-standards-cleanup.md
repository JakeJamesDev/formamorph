# 14: Entity Avatars Standards Cleanup

Status: ready-for-agent
Blocked by: 09, 10, 11, 12, 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a behavior-neutral refactor across several files the other follow-ups touch, so it runs last.

## What to build

Fold in the close review's Standards findings without changing behavior (spec: Post-Close Rulings, Q31):

- Give every `as unknown as` cast a one-line reason, or remove it (the GamePanels You row, the dev fixtures).
- Replace the fake You entity sentinel with a real played-side variant in the entity list.
- Extract one Avatar pick field for the world and library entity editors.
- Reuse the resolver's persona mapping in the Enter World flow instead of rebuilding it.
- Share one helper for stripping the pick from entity comparisons, and use the store type from `@/types` everywhere.
- Remove the dead legacy default-avatar-id migration and its orphaned comment.
- Rename the played-Avatar hooks module after what it exports, and move the visual test out of the component file so library code doesn't import a component.
- Shorten the long TSDoc on the Avatar source hook, and use the glossary words (image, entity) in comments.
- Match the Copy From Library placeholder casing to its label.
- Use "Default Avatar" casing in copy (Q27).

## Acceptance criteria

- [ ] Each item above is done or explained in the landing.
- [ ] No test changes its assertions, except for a renamed import path or the placeholder text.
- [ ] All four gates pass.
