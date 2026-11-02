# 09: Records And Landing Shots

Status: ready-for-agent
Blocked by: 04, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Records and a scripted recapture. The notices generator has a drift guard, so run it, not a hand edit.

## What to build

The Steam checklist and the third-party notices name the files that really ship: Aki, Sei and Praline, each with source, author and license. Elaina's entries and the cleared `readheadedit.vrm` line go away. The notices follow the generator that the Credits effort built.

The landing page's `05-avatar` shots show the new model. Recapture them with the existing site-shot script, and confirm which model it now loads.

Rulings: Q8, Q19, Q20.

## Acceptance criteria

- [ ] `STEAM-RELEASE-CHECKLIST.md` names the real files and states that the Steam build ships no bundled VRM.
- [ ] The notices name all three models, and the drift guard passes.
- [ ] Each model's notice agrees with its provenance record.
- [ ] No tracked doc outside the spec's history names Elaina as shipping.
- [ ] The `05-avatar` shots are recaptured, and the old images are gone from the landing page's output.
- [ ] A changelog fragment is added if the notices change what a player sees.

For you: the recaptured `05-avatar` shots on the landing page.
