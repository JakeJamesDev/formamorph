# 09: Shared Suggestion Keys

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one hook shared by two typeaheads.

## What to build

One suggestion-key hook for list navigation, Enter, Tab and Escape. Enter during IME input finishes the word and does not commit. Both chip typeaheads use it.

Spec: Implementation Decisions: Suggestion keys. Stories 17, 35.

## Acceptance criteria

- [ ] The hook has behavior tests for each key
- [ ] A regression test sends Enter with `isComposing` to the editable chip and nothing commits, and it fails with the old code put back
- [ ] Both typeaheads use the hook
- [ ] Four gates green

## Blocked by

- None (can start immediately)
