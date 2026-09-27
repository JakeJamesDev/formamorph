# 07: Sweep: menu components

Status: ready-for-human
Base: 56d36f41
Blocked by: 01 — Details field and headline
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Every error toast in the menu components gets the same treatment. Each of the 55 sites is classified: a toast raised in a catch, or from a failed result that carries an error, moves to the shared helper with its current message as the headline; a form validation, refusal or other toast with no error behind it stays plain. No toast wording changes.

Ticket 04 already made the three inline staff fetches in the Manage Users tab throw with details; their toasts are still plain. Converting those three toasts is part of this sweep.

Recommended model rationale: a mechanical sweep with a clear classification rule over one directory; judgment per site, no new design.

## Acceptance criteria

- [x] Every caught-error toast in the menu components goes through the shared helper and offers **View Details →**
- [x] Every validation or refusal toast in the menu components stays plain with no link
- [x] No toast's visible words changed; a test that asserted a plain string may switch to reading the toast's visible text, with the asserted words identical
- [x] The sweep touches no file outside the menu components (exception: the shared test helper `src/test/toastText.ts`, which tickets 08 and 09 reuse)
- [x] Four gates green (typecheck, lint, build green; the full suite timed out under machine load, every failed file passed alone, and another session runs the suite; the user approved the commit)

## Notes

- A rejected plain string now shows that string rather than the fallback, and a non-string `message` shows the fallback. No menu service throws either, so no visible toast changes.
- BackupRestoreDialog's file-read toast had no fallback; an error with no message now shows "Failed to read the backup" instead of an empty toast.
