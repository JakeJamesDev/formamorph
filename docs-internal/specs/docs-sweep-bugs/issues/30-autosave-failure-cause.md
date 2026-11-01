# 30: Autosave Failure Says Why

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one save path returns its cause to one message, under the Writing Guide.

## What to build

A failed autosave reads "Autosave failed — your manual saves still work." The cause goes only to the console, and the save call returns a plain `false`. Manual saves write to the same store, so with full storage the promise is likely false. Ruling Q25: the message drops that promise and carries the cause. Full storage says the storage is full and what the player can do. Any other failure shows a written line with the cause in **View Details**. The message still shows once until an autosave succeeds again.

Read how the app's other storage-full message works first, and reuse its check.

Spec: Q25. Evidence: the error audit after this spec's close.

## Acceptance criteria

- [ ] A test with a quota error on an autosave fails today (the old sentence), then passes with the storage-full message
- [ ] A test with another error shows a written line and the cause in View Details
- [ ] No autosave failure message claims that manual saves still work (test)
- [ ] The message shows once across repeated failures and shows again after a success then a new failure (test)
- [ ] A manual save's failure message is unchanged (test)
- [ ] The new copy follows the Writing Guide; the copy sweep ran on it
- [ ] A changelog fragment under Minor / Fixed / 👤
