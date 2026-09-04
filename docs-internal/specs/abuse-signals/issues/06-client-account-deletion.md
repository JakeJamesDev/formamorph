# 06 — Client: the deletion flow and the decline screen's third button

Status: done
Type: task
Blocked by: 04, 05
Spec: ../spec.md (Implementation Decisions › Account deletion; User Stories 4, 32–40)

Repo: formamorph.

## Task

- **Profile → Delete account**: a control in the profile dialog opening a flow of three steps: what happens (the seven-day window, that logging in cancels it, that suspended accounts ask via Feedback); the single choice "Also delete everything you published?" with what each answer means in one line each; password entry and the final button. Success shows the date erasure will run and signs the user out.
- **Suspended**: the control still shows, but the flow's first step says to request through Feedback and offers a link to it; no password step.
- **Decline screen**: the Privacy Policy prompt from ticket 04 gains its third button, Delete my account, which opens this flow directly.
- **Cancelled notice**: when the login response carries the cancelled flag, show a one-time notice: "Your account deletion was cancelled."
- Dev-router entries for the flow and the notice.

## Acceptance

- A wrong password stays in the flow with the server's message; a correct one ends signed out with the date shown.
- The content choice is required — no default.
- The decline screen's three buttons each do exactly one thing.
- The suspended path never sends a request.

## Tests

- Component tests over mocked fetch on the profile dialog pattern; assert the request body carries the content choice and the password, and that the suspended branch sends nothing.
- The Playwright spec from ticket 04 gains: decline → Delete my account → the flow's first step is visible.
- Preview via dev-router; static frames.

## Answer

Shipped in formamorph `bc78ad6e` ("Let An Account Delete Itself"): Profile → Delete Account and the third button on the policy prompt (`6e179a24`, `7ffc19b4`). Changelog: the 👤 "You can now delete your own account" entry.
