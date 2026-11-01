# 25: Bad Preset Listing Says Listing

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

Sonnet at low: one error line on one download branch.

## What to build

On the website, a preset listing with bad content shows "This file is not a Formamorph prompt preset." The source there is a listing, not a file. Ruling Q21: the website download shows its own line that says "listing". The app's file import keeps its text.

Spec: Q21. Evidence: ticket 05, Landed.

## Acceptance criteria

- [ ] A device-download test with a bad preset listing fails today (the file text), then passes with the listing line
- [ ] The app's preset file import keeps its text (existing test green)
- [ ] The line follows the Writing Guide; the copy sweep ran on it
- [ ] A changelog fragment under Minor / Fixed / 👤
