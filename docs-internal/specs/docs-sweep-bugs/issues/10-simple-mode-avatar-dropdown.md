# 10: Avatar Dropdown in Simple Mode

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one gate removed, but tests that lock in the old split change on purpose and four docs passages move with it.

## What to build

In Simple mode, the Media tab offers **Upload Avatar…**, but the entity **Avatar** dropdown shows in Advanced mode only, so an uploaded Avatar can't be assigned. Ruling Q4: the dropdown shows in Simple mode too. Update the tests that lock in the old split on purpose.

Spec: Q4, Implementation Decisions "Simple mode Avatar". Evidence: docs-sweep ticket 07, Landed.

## Acceptance criteria

- [x] A World Editor entity test in Simple mode fails today (no **Avatar** dropdown), then passes and assigns an uploaded Avatar. `shows in Simple mode and assigns an uploaded Avatar` failed on the missing combobox before the fix.
- [x] The upload tests that run in both modes still pass; any test that asserted the dropdown absent in Simple is changed and named in Landed. All 32 tests in `WorldEditor.worldAvatars.test.tsx` pass.
- [x] World-Editor-Media, Avatars and World-Editor-Entities no longer call the dropdown Advanced only; the docs tests are green. `src/lib/docs` passes.
- [x] A changelog fragment under Minor / Fixed / 👤. `docs-internal/changelog.d/10-simple-mode-avatar-dropdown.md`.

## Landed

**Changed test:** `is hidden in Simple mode` in `WorldEditor.worldAvatars.test.tsx` asserted the dropdown absent in Simple. It is now `shows in Simple mode and assigns an uploaded Avatar`.

**Not verified:** none.

**For you:** none.
