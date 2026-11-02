# 12: Hosted State Read Behind the Age Gate

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: a rule breach at boot; the fix moves a read across the provider tree and reworks the hosted SettingsContext tests without losing what they guard.

**What to build:** the app never asks the server for the hosted state until the age gate is answered. Today `SettingsContext` refreshes the hosted state whenever Formamorph AI is active or pinned, and `SettingsProvider` sits outside `AgeGateProvider`, so a player with Formamorph AI selected sends that read at boot before answering the gate. Only the one-time switch (`HostedAiAutoSwitch`) waits for the gate today. Found in the close review.

- [x] No hosted-state read leaves the app before the age gate is answered, whether Formamorph AI is active, pinned to a prompt, or neither (test: a boot with the preset active and the gate unanswered sends no read; answering the gate sends one). Verified by `SettingsContext.hosted.test.tsx` "sends no read before the answer, and one after it" (active, pinned, never switched), against the real `AgeGateProvider`. The account-change path is covered too: "sends no read for a new account until that account answers the gate".
- [x] After the gate is answered, the read and the re-read on an account change behave as before (the existing hosted SettingsContext tests still pass, adapted to mount inside the gate). Verified: the four existing hosted tests pass inside the gate, and the new test "reads again for a new account once its answer is in" covers the re-read.
- [x] Builds with community features off (no gate) still read the hosted state when the preset is in use. Verified by `SettingsContext.hosted.communityOff.test.tsx`: one read, no age-gate request.
- [x] The guard is proven by removing it once. Verified: without the `attestedSession` check in `HostedAiStateSync`, 5 hosted tests go red. The old account-change listener failed the new-account test (2 reads, expected 1).

## Landed

The automatic reads moved into `HostedAiStateSync` (renamed from `HostedAiAutoSwitch`, per the spec session). The review found that an account change read the new account's state before its gate answer. `AgeGateProvider` now tags each state with its session and exposes `attestedSession`, and the reader keys on it. `hostedSession.accountChanged()` drops the old account's state without a read.

**Not verified:** nothing.

**For you:**
- Sign in, switch accounts in a second tab, and check that the Formamorph AI preset status clears for the new account.
- A hosted chat call before attestation is out of scope here (spec-session ruling Q2). This ticket did not audit those paths.
