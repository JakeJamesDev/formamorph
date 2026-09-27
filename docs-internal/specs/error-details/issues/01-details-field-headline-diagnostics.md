# 01: Details field, headline and diagnostics in every error toast

Status: ready-for-human
Base: c8a7f81d
Blocked by: None (can start immediately)
Recommended model: Claude Fable 5.1 (`claude-fable-5-1`)
Reasoning effort: high

## What to build

Every error toast raised through the shared error-toast helper offers **View Details →**, whatever error it was given. Error Details shows the message, the cause, the error's name, cause chain and top of stack, and ends with the same version, platform and system block the bug report collects. **Copy** puts all three parts on the clipboard.

A caller can pass a headline. The headline becomes the toast text and the error's own message moves into the details, so a fixed message like "Failed to save" keeps its words and still reveals the cause.

The helper detects details by a string `details` field on the error, not by class, so existing error classes can carry details later without changing type. `DetailedError` stays as the plain class for throw sites that have no class of their own. A failed result that holds only a string is wrapped so it still gets the link.

Recommended model rationale: this ticket sets the contract every other ticket builds on and touches a shared UI surface; it needs careful design and thorough tests.

## Acceptance criteria

- [x] Calling the helper with a plain `Error` shows a toast with **View Details →**; the window lists the error's name, message, cause chain and no more than 10 stack frames
- [x] Calling the helper with a headline shows the headline as the toast text and the error's message inside the details
- [x] An error with a string `details` field shows those details verbatim; a class check is not used
- [x] A string failure reason is wrapped and still gets the link
- [x] Error Details ends with the diagnostics block from the existing collector; Copy includes message, details and that block
- [x] Plain `toast.error` calls with no error behind them are unchanged and have no link
- [x] The `#dev?modal=errorDetails` route still raises its sample toast and the dialog shows the diagnostics block
- [x] Mutation checks: removing the headline handling, dropping the diagnostics block and skipping the string wrap each fail a test
- [x] Four gates green
