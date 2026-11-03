# 06: Preview Chips

Status: ready-for-human
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q5; Preview)

Adds an opt-in seam to a shared editor and an async read with stale and unmount handling.

## What to build

The Preview tab of the listing comment box and every feedback comment box draws real chips. Preview resolves once each time the tab opens, through the resolve route. Text with no links sends no request. Until targets arrive, and on any failure, Preview shows plain markdown with no toast. A stale response is dropped, and an unmounted Preview cancels its request.

`PromptField` gains an opt-in way to replace its markdown Preview renderer. Prompt editors do not pass it and keep their current Preview.

## Acceptance criteria

- [x] The listing comment box's Preview draws chips after the resolve. Test: the rendered modal with a mocked resolve. (`RemoteWorldDetailsModal.previewChips.test.tsx`, new and edit boxes)
- [x] The feedback reply, comment edit, new thread and thread edit boxes draw chips in Preview. Test: rendered feedback components with a mocked resolve. (`FeedbackPreview.test.tsx`, one case per box)
- [x] Preview shows plain markdown while waiting and after a failure, with no Unknown user chip and no toast. Test: a pending and a rejected mock. (`FeedbackPreview.test.tsx`, pending and failure cases)
- [x] Text with no links sends no request. Test: the mock is not called. (`sends nothing for text with no links`)
- [x] Switching to Edit, changing the text and reopening Preview drops the older response. Test: two mocks resolved out of order. (two `drops an older response` cases)
- [x] An unmount during the request writes no state and leaks no error. Test: unmount with a pending mock. (`cancels at unmount`, `stays quiet`: the signal aborts and no error shows. React drops a late write without a sign, so removing the `aborted` check fails no test.)
- [x] A `PromptField` with no opt-in keeps its current Preview. Test: the existing `PromptField` Preview tests stay green. (`keeps the field's own Preview`, plus the gates)
- [x] The site bundle boundary test stays green. (Green after raising its module ceiling from 102 to 103 for `FeedbackPreview`, recorded in the test's ledger)
- [x] A changelog fragment covers chips in Preview. (`docs-internal/changelog.d/listing-comment-links-06.md`)
- [x] Frames of the listing box's Preview with chips, light and dark: `.scratch/frames/preview-chips-<theme>.png`. (New dev route `#dev?modal=listingComment&fixture=feedback`; chips come from the feedback stub.)

## Landed

**Not verified**
- None. The resolve route itself was not called: tests mock it and the frames use the dev stub.

**For you**
- Preview chips in the listing box: `.scratch/listing-comment-links-06/frames/preview-chips-dark.png`, `.scratch/listing-comment-links-06/frames/preview-chips-light.png`.
- In Full screen on a wide window, Edit and Preview sit side by side. Chips go plain at the first keystroke and return only when the pane opens again (spec ruling).
- In Preview, a thread or listing chip opens a new tab, and a bug chip in a feedback box does nothing (spec ruling).
