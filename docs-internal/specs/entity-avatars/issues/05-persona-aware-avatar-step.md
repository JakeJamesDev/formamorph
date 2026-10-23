# 05: Persona-Aware Avatar Step

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: the step list moves from a per-world gate to the draft persona, and the picker narrows; the seeding helper already exists from ticket 03.

## What to build

The Enter World avatar step follows the draft persona (spec: Enter World; Q10). It shows when the played entity would resolve to any Avatar, and its label (Continue to Avatar or Start Game) updates when the persona pick changes. The Avatar picker shows only when that Avatar is User's Default. It lists library Avatars only and starts on the device default. The old "World Avatar" option goes. New games and Quick Start seed default customization whenever the played entity resolves to an Avatar, through ticket 03's helper.

## Acceptance criteria

- [x] enterFlow tests: step shown for any Avatar, skipped for none, and a step list that changes with the persona pick. `enterFlow.test.ts` › "the avatar step follows the draft persona"; the label switch in `MainMenu.avatarStep.test.tsx`.
- [x] The picker appears only on User's Default, lists library Avatars, and starts on the device default. `MainMenu.avatarStep.test.tsx` (picker, hidden picker with the author's preview); start fallbacks in `defaultAvatar.test.ts`.
- [x] Quick Start into a world whose played entity has an Avatar starts with seeded customization. `MainMenu.avatarStep.test.tsx` › Quick Start.
- [x] Frame `.scratch/frames/05-avatar-step.png`, light and dark, 1280 wide. Playwright on the `avatar` dev route: `.scratch/entity-avatars-05/frames/05-avatar-step-light.png` and `-dark.png` (picker variant).
- [x] Changelog fragment. `docs-internal/changelog.d/entity-avatars-05.md`.

For you: walk Enter World in a world with two personas, one with an author Avatar and one on User's Default.

## Landed

**Not verified**
- Nothing unticked. The frames show the User's Default picker only; the hidden-picker variant is covered by the DOM test, not a frame.

**For you**
- For you: walk Enter World in a world with two personas, one with an author Avatar and one on User's Default.
- The workspace button now reads **Start Game** (title case). Several wiki pages still say "In a world with a 3D model, the button reads Continue to Avatar"; ticket 08 owns that prose.
- A library persona's record loads after the pick. A click on **Start Game** in that short window still opens the avatar step when the persona has an Avatar (T05-6).
