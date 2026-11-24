# 01: Edit the Avatar in Play

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the customization hook's capability effects can overwrite a seeded look on first load, and the editor needs a second host and mode without changing the enter-world flow.

## What to build

The played Avatar shows a pencil in its bottom-right corner during play. It shows in the played entity's view and in the You row, and never on another entity (Q4). It is hidden while the player views a past turn (Q1). It is also hidden when the editor would have nothing to change, meaning no Avatar picker and no slider or color on the loaded model (Q10). The pencil works while a turn runs (Q7), and it does not block rotating or zooming the Avatar.

The pencil opens the existing Avatar customization screen in an edit mode. It is a dialog on desktop and the full screen with its controls drawer on mobile (Q6). The Android back button closes it. The screen starts from the save's look:
- body morphs, hairstyle, hair length and extra colors as stored;
- a hair, eye or skin color counts as changed only when the stored look has it;
- the picker starts on the save's chosen Avatar.

The preview shows the base look with no stats on top (Q2). In an unlocked world the player can switch Avatars or add a .vrm, and switching resets the sliders (Q3). In a locked world the picker stays hidden. Trait-held sliders stay locked, with the same trait lock as at entry. **Save** replaces the live look at once, with no turn snapshot and no history entry. **Cancel** closes at once with no changes and asks to discard with changes (Q9). The narrator is not told (Q8). The enter-world Avatar step keeps its current behavior. A dev-route entry opens the in-game editor.

Spec: Q1–Q4, Q6–Q10; stories 1–14, 16–23, 25–28.

## Acceptance criteria

- [x] The pencil shows on the played Avatar in the entity view and in the You row, and on no other entity's Avatar (in-game panel test). `GamePanels.avatarEdit.test.tsx` "shows on the played Avatar" (You row) and "never shows on another entity's Avatar"; a played world entity's view by the `avatarIcon` dev-route frames.
- [x] The pencil is hidden on a past turn (in-game panel test). "is hidden on a past turn"; bites with the past-page guard removed.
- [x] The pencil is hidden in a locked world when the model reports no slider or color (in-game panel test). "is hidden in a locked world…" and "shows in a locked world once…"; bites with the controls guard removed.
- [x] The editor opens with the stored morphs, hairstyle, hair length, extra colors and chosen Avatar (in-game panel test). "opens on the stored look and chosen Avatar…".
- [x] A color the stored look lacks is still absent from the look after Save with no change (in-game panel test; proven to bite by dropping the seeded flag). Save is disabled until something changes, so "keeps untouched colors absent…" saves after one slider step; bites with the flags dropped and with every flag on.
- [x] The first model load does not overwrite a seeded color or hairstyle (in-game panel test). "opens on the stored look…" (the stub reports the model's own hair color); bites with the keep-seeded guard removed.
- [x] Save changes the in-game Avatar's viewer props at once and writes no turn snapshot (in-game panel test). "Save changes the in-game Avatar at once…".
- [x] Cancel with no changes closes at once; Cancel with changes asks first, and confirming leaves the stored look as it was (in-game panel test). Three Cancel tests, the Quick Start case included, plus "Escape … asks first".
- [x] Switching Avatars in an unlocked world saves the new chosen Avatar; a locked world shows no picker (in-game panel test). "saves a switched Avatar…", "shows no Avatar picker in a locked world".
- [x] Trait-held sliders show as locked in the in-game editor (in-game panel test). "shows trait-held sliders as locked".
- [x] The enter-world Avatar step's existing tests pass unchanged. `EnterWorldFlow.avatarStep`, `EnterWorldFlow.customizationLock` and `CharacterCustomization.emptyState` green, unedited.
- [x] A dev-route entry opens the editor; frames `.scratch/frames/avatar-edit-desktop-light.png`, `.scratch/frames/avatar-edit-desktop-dark.png` at 1440 px and `.scratch/frames/avatar-edit-mobile-dark.png` at 390 px. `#dev?view=gameViewer&fixture=avatarIcon&modal=avatarEdit`; on mobile, open the Story tab.
- [x] The pencil's label, the buttons and the Cancel confirm follow the Writing Guide (copy-sweep). Two notices, both kept: a confirmation keeps its period, and the other line is older text.
- [x] A changelog fragment describes the feature. `docs-internal/changelog.d/in-game-avatar-edit-01.md`, rollback and regenerate included.

For you: the pencil's size and position over the Avatar in the entity view and the You row, on desktop and mobile.
For you: whether the dialog size gives the preview enough room on a typical laptop screen.

## Landed

**Not verified**
- The pencil in the Entity dialog for the played entity (Q4) is wired through the same component but has no test of its own.
- The Android back button on a device. The Escape path it uses is tested.

**For you**
- The pencil's size and position over the Avatar in the entity view and the You row, on desktop and mobile.
- Whether the dialog size gives the preview enough room on a typical laptop screen. Frames: `.scratch/in-game-avatar-edit-01/frames/avatar-edit-desktop-light.png`, `.scratch/in-game-avatar-edit-01/frames/avatar-edit-desktop-dark.png`, `.scratch/in-game-avatar-edit-01/frames/avatar-edit-mobile-dark.png`.
- On mobile, Cancel and Save sit in the **Customize** drawer, as at entry; back closes the editor. Check this reads well on a device.
- Save stays disabled until something changes, following the design system's Save rule.
