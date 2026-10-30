# 12: Hosted State Read Behind the Age Gate

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: a rule breach at boot; the fix moves a read across the provider tree and reworks the hosted SettingsContext tests without losing what they guard.

**What to build:** the app never asks the server for the hosted state until the age gate is answered. Today `SettingsContext` refreshes the hosted state whenever Formamorph AI is active or pinned, and `SettingsProvider` sits outside `AgeGateProvider`, so a player with Formamorph AI selected sends that read at boot before answering the gate. Only the one-time switch (`HostedAiAutoSwitch`) waits for the gate today. Found in the close review.

- [ ] No hosted-state read leaves the app before the age gate is answered, whether Formamorph AI is active, pinned to a prompt, or neither (test: a boot with the preset active and the gate unanswered sends no read; answering the gate sends one).
- [ ] After the gate is answered, the read and the re-read on an account change behave as before (the existing hosted SettingsContext tests still pass, adapted to mount inside the gate).
- [ ] Builds with community features off (no gate) still read the hosted state when the preset is in use.
- [ ] The guard is proven by removing it once.
