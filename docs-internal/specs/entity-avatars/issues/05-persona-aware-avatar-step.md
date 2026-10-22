# 05: Persona-Aware Avatar Step

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: the step list moves from a per-world gate to the draft persona, and the picker narrows; the seeding helper already exists from ticket 03.

## What to build

The Enter World avatar step follows the draft persona (spec: Enter World; Q10). It shows when the played entity would resolve to any Avatar, and its label (Continue to Avatar or Start Game) updates when the persona pick changes. The Avatar picker shows only when that Avatar is User's Default. It lists library Avatars only and starts on the device default. The old "World Avatar" option goes. New games and Quick Start seed default customization whenever the played entity resolves to an Avatar, through ticket 03's helper.

## Acceptance criteria

- [ ] enterFlow tests: step shown for any Avatar, skipped for none, and a step list that changes with the persona pick.
- [ ] The picker appears only on User's Default, lists library Avatars, and starts on the device default.
- [ ] Quick Start into a world whose played entity has an Avatar starts with seeded customization.
- [ ] Frame `.scratch/frames/05-avatar-step.png`, light and dark, 1280 wide.
- [ ] Changelog fragment.

For you: walk Enter World in a world with two personas, one with an author Avatar and one on User's Default.
