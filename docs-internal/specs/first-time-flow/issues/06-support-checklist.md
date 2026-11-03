# 06: Support Checklist

Status: ready-for-human
Blocked by: 04, 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: wires existing auth, age gate, Patreon and preset paths into one surface, with no new service.

**What to build:** **Support on Patreon** in the scene opens a guided checklist: sign in with the 18+ check, pledge on Patreon, link Patreon, switch to Formamorph AI. Each step shows its real state, and a player who returns from Patreon picks up where they left off. The fire beside Morphie grows with each finished step.

- [x] Each step reads real state through `AuthService`, `useAgeGate`, `PatreonService.getStatus()` and the active preset, and re-reads on focus. `SupportChecklist.test.tsx`: "re-reads on focus, so a player back from Patreon sees the finished link". The pledge reads the linked status's tier (spec Q53); the hosted state is not read.
- [x] Each action reuses the existing path: `requestSignIn` (signed out; its host runs the age gate) or `requireAttestation` (signed in, 18+ check open), the Patreon page, `startLink`, and `selectTextEndpointPreset`, so the switch-back still works. Tests for each action in `SupportChecklist.test.tsx`; the switch-back itself is not exercised.
- [x] Rendered tests cover every state, including a return from Patreon with the link not done. A player already signed in starts past step one. `SupportChecklist.test.tsx`, 12 tests. A pledge done with the link not done can't exist under Q53: only a link shows a tier.
- [x] A player who finishes returns to the story on Formamorph AI. **Finish Later** returns to the story and loses no progress. "a link with a tier finishes the pledge and the link together, and Switch …", "Finish Later returns to the story and writes nothing", "a later open starts from the live state".
- [x] Morphie plays the Jelly on each finished step, and no row moves. `RoadScene.test.tsx`: "plays the Jelly on each finished step and moves no row"; `e2e/support-checklist.spec.ts` row order and no overlap in five states.
- [x] Button order follows Paired Footer Actions. `RoadScene.test.tsx`: "keeps Finish Later before the main action".
- [x] The checklist has a dev route. `#dev?modal=road&tab=checklist&subtab=<start|signedIn|visited|noPledge|linked|finished>`. Frames at `.scratch/frames/checklist-1280.png` and `.scratch/frames/checklist-375.png`, with the other states beside them.
- [x] A changelog fragment states what changed for the player. `docs-internal/changelog.d/first-time-flow-06.md`.

For you: the checklist's wording, and one real run with your own Patreon test pledge.

## Landed

**Not verified**
- A real sign-in, link and switch against the live Patreon and the server. Every test stubs `AuthService`, `PatreonService`, the age gate and settings, and the frames use canned states.
- The sign-in dialog and the age gate opening over the full-screen scene. No test or frame shows their stacking. In my local preview, Sign In on the `start` sample opened no dialog. I did not find out why, and I suspect community accounts are off in this build.
- The preset switch-back after Switch to Formamorph AI. The tests assert the call to `selectTextEndpointPreset`, not what it records.
- Nothing opens the checklist directly yet. `openRoadScene('checklist')` is for ticket 11's panel (Q28, Q53), so today it is reached through Support on Patreon in the levels. An open scene does not switch view on a second call.
- Before the first status read answers, a signed-in player who linked earlier briefly sees Open Patreon as the main action.
- 375 is a layout test and a frame on the desktop project, not a device.

**For you**
- For you: the checklist's wording, and one real run with your own Patreon test pledge.
- A Spark pledger ends on the Beacon fire, because the fire shows progress (spec Q53), not the player's tier. Look at `.scratch/first-time-flow-06/frames/checklist-1280.png`.
- A player who pledged earlier finds Link Patreon as a link inside the Link Patreon row, while the main button stays on the next step.
