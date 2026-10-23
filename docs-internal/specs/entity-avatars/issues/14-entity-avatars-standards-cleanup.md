# 14: Entity Avatars Standards Cleanup

Status: done
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

- [x] Each item above is done or explained in the landing. Spec review checked each bullet; the notes below cover the partial ones.
- [x] No test changes its assertions, except for a renamed import path or the placeholder text. The `hasEntityVisual` tests moved word for word to `src/lib/entityVisual.test.ts`; `libraryVrmDelete.test.ts` follows the Q27 copy (T14-4).
- [x] All four gates pass. Prepare's gate run.

## Landed

How each item landed:

- **Casts:** the GamePanels You row and the dev fixtures' `AVATAR_PERSONA` lose their `as unknown as`. The older casts in `devFixtures.ts` predate this effort and stay.
- **You row:** `EntityViewSubject` (an entity, or the played side) replaces the fake `Entity`. A typed `PLAYED_SIDE` visual source (`id`, `name`) still feeds `EntityVisual` and the hooks, which take narrow picks.
- **Pick field:** `AvatarPickField` in `EntityFields.tsx` serves both editors.
- **Persona mapping:** `playedVrmAs` in `vrmResolver.ts` serves `playVrmContext` and `entryVrmPick`.
- **Strip and store type:** `withVrmPick` in `worldVrmStore.ts` replaces five hand-written strips. Source files use `WorldVrmStore`; test files keep their `Record<string, WorldVrm>` annotations.
- **Legacy migration:** kept, not dead (T14-1). Its detached comment is rewritten onto the function, and its cast is a typed local.
- **Rename and move:** `usePlayedVrm.ts` is `useLibraryAvatars.ts`. `hasEntityVisual` is in `src/lib/entityVisual.ts`; the `EntityModal` test mock drops its stub key for it.
- **Comments, placeholder, copy:** `useVrmSourceUrl` TSDoc shortened; "picture", "portrait", "character" become image and entity in this effort's comments; "Copy From Library"; "Default Avatar" in the delete dialog and `docs/Avatars.md`.

**Not verified:** nothing.

**For you:** nothing; the change is behavior-neutral.
