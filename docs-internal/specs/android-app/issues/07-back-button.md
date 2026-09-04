# 07 — Hardware back button

Status: ready-for-agent
Type: task
Blocked by: 04
Spec: ../spec.md (Implementation Decisions › The back button)

## Task

- Pure function: given the app's view state (open modal, current view, view history), return `close-modal`, `go-back`, or `confirm-exit`.
- Thin hook subscribed to Capacitor's back event that applies the action. Confirm-exit reuses the existing confirm dialog and calls the app exit on yes.
- Mount the hook only when the Android bridge exists.

## Acceptance

- Table test for the pure function across modal open, nested view, main menu.
- On the phone: back closes an open modal, returns from the game to the main menu, and asks before exiting from the main menu.
- Four gates green.
