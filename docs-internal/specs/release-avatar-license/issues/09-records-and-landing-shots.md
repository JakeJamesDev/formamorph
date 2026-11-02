# 09: Records And Landing Shots

Status: done
Blocked by: 04, 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Records and a scripted recapture. The notices generator has a drift guard, so run it, not a hand edit.

## What to build

The Steam checklist and the third-party notices name the files that really ship: Aki, Sei and Praline, each with source, author and license. Elaina's entries and the cleared `readheadedit.vrm` line go away. The notices follow the generator that the Credits effort built.

The landing page's `05-avatar` shots show the new model. Recapture them with the existing site-shot script, and confirm which model it now loads.

Rulings: Q8, Q19, Q20.

## Acceptance criteria

- [x] `STEAM-RELEASE-CHECKLIST.md` names the real files and states that the Steam build ships no bundled VRM. Edited in the main checkout after the landing (the file is git-excluded).
- [x] The notices name all three models, and the drift guard passes. Entries for Aki, Sei and Praline plus the Steam line; `shipNotices.test.ts` runs in prepare's gates.
- [x] Each model's notice agrees with its provenance record. Author, source and license compared with `provenance.md` and the three files' VRM metadata, read by script.
- [x] No tracked doc outside the spec's history names Elaina as shipping. Grep of tracked files: only spec history (release-blockers, Credits, landing-page and this spec's tickets) and the bundled-avatar test's old-build seed name remain.
- [x] The `05-avatar` shots are recaptured, and the old images are gone from the landing page's output. Same paths, overwritten; the graphite/dark frame shows Player Avatar "Sei" and the maid model.
- [x] A changelog fragment is added if the notices change what a player sees. `release-avatar-license-09.md`; the Licenses tab shows these entries.

For you: the recaptured `05-avatar` shots on the landing page.

## Landed

**Not verified**
- Criterion 1: the checklist edit is outside the commit, done in the main checkout after the landing.

**For you**
- The recaptured `05-avatar` shots on the landing page: `.scratch/release-avatar-license-09/frames/05-avatar-graphite-dark.webp` shows the capture's graphite/dark frame.
