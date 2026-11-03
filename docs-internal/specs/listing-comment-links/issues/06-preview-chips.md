# 06: Preview Chips

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q5; Preview)

Adds an opt-in seam to a shared editor and an async read with stale and unmount handling.

## What to build

The Preview tab of the listing comment box and every feedback comment box draws real chips. Preview resolves once each time the tab opens, through the resolve route. Text with no links sends no request. Until targets arrive, and on any failure, Preview shows plain markdown with no toast. A stale response is dropped, and an unmounted Preview cancels its request.

`PromptField` gains an opt-in way to replace its markdown Preview renderer. Prompt editors do not pass it and keep their current Preview.

## Acceptance criteria

- [ ] The listing comment box's Preview draws chips after the resolve. Test: the rendered modal with a mocked resolve.
- [ ] The feedback reply, comment edit, new thread and thread edit boxes draw chips in Preview. Test: rendered feedback components with a mocked resolve.
- [ ] Preview shows plain markdown while waiting and after a failure, with no Unknown user chip and no toast. Test: a pending and a rejected mock.
- [ ] Text with no links sends no request. Test: the mock is not called.
- [ ] Switching to Edit, changing the text and reopening Preview drops the older response. Test: two mocks resolved out of order.
- [ ] An unmount during the request writes no state and leaks no error. Test: unmount with a pending mock.
- [ ] A `PromptField` with no opt-in keeps its current Preview. Test: the existing `PromptField` Preview tests stay green.
- [ ] The site bundle boundary test stays green.
- [ ] A changelog fragment covers chips in Preview.
- [ ] Frames of the listing box's Preview with chips, light and dark: `.scratch/frames/preview-chips-<theme>.png`.
