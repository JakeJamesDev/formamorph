# 07: Root Crash Screen and Global Handlers

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: a root boundary with a provider-independent export path and a toast throttle with an ignore list.

## What to build

A crash of the whole app shows a recovery screen instead of a blank page (Q18, Q10). The root boundary sits above the data provider. Its screen, approved from a mock: warning icon, title "Formamorph Stopped Working", a line telling the user to reload and to export first when unsaved edits exist, and buttons Copy Error Details, Export World (only when unsaved edits exist) and Reload. Copy Error Details copies the error and component stack as text, since the Error Details dialog's host is gone.

Export World reads a plain module reference to the last world the data provider committed, with no copy (Q22). The button is hidden when no world is held.

Global handlers log every unhandled rejection and window error and toast through the existing error toast with View Details (Q11). Toasts are deduplicated by message, throttled to one per message per 10 s, and capped at 5 per session. An ignore list drops resize-observer loop notices, opaque cross-origin script errors, abort errors, and errors from browser extensions. One changelog fragment, Minor Added, 👤.

## Acceptance criteria

- [ ] A component that throws during render below the root shows the crash screen with the approved title and buttons.
- [ ] With unsaved world edits held, Export World downloads the last committed world; with none, the button is absent.
- [ ] Copy Error Details puts the message and component stack on the clipboard.
- [ ] Reload reloads the app.
- [ ] An unhandled rejection shows one error toast with View Details; the same message ten times within 10 s shows one toast; a sixth distinct error in a session logs but shows no toast.
- [ ] A ResizeObserver loop notice, a "Script error." event and an AbortError produce no toast.
- [ ] Guard bites: removing the dedupe turns the repeat test red.
- [ ] Four gates green.
