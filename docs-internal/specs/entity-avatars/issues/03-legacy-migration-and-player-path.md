# 03: Legacy Migration and Player Path

Status: done
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a shipped-shape migration that runs on every load, a world-aware save remap, and the player's Avatar rewired through the resolver without changing what old worlds show.

## What to build

Old worlds keep working and the checkbox leaves the editor (spec: Legacy fallback and migration, Saves; Q4, Q13, Q20, Q22, Q24). The migration reads the raw old flag: only an explicit `true` turns the hidden fallback on; missing or `false` means no Avatar. The load normalization and the other `true` defaults (initial world state, default-world seed) go. With the flag on and an old world Avatar, that Avatar moves into the store under a fixed reserved id, stable across loads, and the fallback points at it; without one, the fallback resolves to User's Default. The migration assigns no entity an Avatar and creates no Custom Persona. The editor drops the fallback once a Custom Persona has a pick other than none. The checkbox, the old uploader, the old world Avatar field and both history labels go.

At game load, where the world is known, a save's chosen Avatar of unset or "the world's" remaps to the fixed id, or to nothing. A save made before this change keeps a library Avatar it chose. Default avatar customization is seeded for an old save whose played entity resolves to an Avatar but holds none. This ticket owns that seeding helper, and ticket 05 reuses it. The existing player Avatar view resolves through the resolver, so old worlds show the same Avatar as before.

## Acceptance criteria

- [x] Migration tests: missing flag, `false`, `true` without an old Avatar, `true` with one, a world with a Custom Persona, persona entities left unassigned, a second run (idempotent), and the same store id across two loads. (`legacyVrm.test.ts` "the legacy Avatar migration"; the missing-flag guard bites when the old `true` default comes back.)
- [x] Save tests at game load: chosen Avatar unset, "the world's", a library id, and Q24's legacy library pick. (`legacyVrm.test.ts` "remapping a save at game load"; `GameplayContext.legacyAvatar.test.tsx` through `loadGame`, with seeding.)
- [x] A world with the flag `true` and an old Avatar shows it under None, a library persona, and a world persona with pick none. (Resolver on the migrated world, all three, in `legacyVrm.test.ts`; the viewer's model URL under None and a world persona in `GamePanels.legacyAvatar.test.tsx`.)
- [x] The editor no longer shows the checkbox or the old uploader; the fallback is dropped once a Custom Persona has a non-none pick (worldEditorBench). (`WorldEditor.legacyAvatar.test.tsx`: pick and role-change paths, one undo Step, delete of the reserved entry.)
- [x] Every reader of the old world Avatar field reads the store or the resolver instead (morph names, customization, model usage). (No `customPlayerVRM` or `use3DModel` reader left outside the migration; `useBodyMorphNames`, `CharacterCustomization`, `modelUsage` tests.)
- [x] Changelog fragment in `docs-internal/changelog.d/`. (`entity-avatars-03.md`.)
- [x] Export-shape reminder in the landing: the editor-facing flag and the old world Avatar field go, the world gains the fallback, and saves remap the chosen Avatar. (In the landing report.)

For you: open an old world that had a custom Avatar and confirm it looks the same in play.

## Landed

**Not verified**
- Nothing in the play view in a browser: the player Avatar view is checked through the GamePanels harness only.

**For you**
- For you: open an old world that had a custom Avatar and confirm it looks the same in play.
- The World Overview's store rows have no Preview or Export: the old uploader's preview and export left with it.
