# 25: Bad Preset Listing Says Listing

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one error line on one download branch.

## What to build

On the website, a preset listing with bad content shows "This file is not a Formamorph prompt preset." The source there is a listing, not a file. Ruling Q21: the website download shows its own line that says "listing". The app's file import keeps its text.

Spec: Q21. Evidence: ticket 05, Landed.

## Acceptance criteria

- [x] A device-download test with a bad preset listing fails today (the file text), then passes with the listing line (`refuses listing content that is not a preset share file`: red on the old code, green after)
- [x] The app's preset file import keeps its text (`promptPresetShare.ts` untouched)
- [x] The line follows the Writing Guide; the copy sweep ran on it (`copy:sweep` 0 notices; spec session approved the line)
- [ ] A changelog fragment under Minor / Fixed / 👤 (skipped by spec-session ruling, see Landed)

## Landed

**Not verified**
- Changelog fragment: skipped. The spec session ruled that ticket 05's unreleased entry already covers the device download's preset branch.

**For you**
- Download a preset listing with bad content on the website and read the error toast: it says "This listing is not a Formamorph prompt preset."
