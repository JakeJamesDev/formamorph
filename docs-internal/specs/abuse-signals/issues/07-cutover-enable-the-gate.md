# 07 — Cutover: enable the Privacy Policy

Status: ready-for-human
Type: task
Blocked by: 01, 03, 04
Spec: ../spec.md (Further Notes › Cutover order)

Human-in-the-loop. No code. Ticket 06 need not have landed: the two-button decline is acceptable to enable on, and the third button arrives with the next client release.

## Task, in order

1. Confirm `https://formamorph.ai/privacy` renders the reviewed text.
2. Confirm the deployed server has the salt set and the Signals sweeper running (its boot log line).
3. Confirm the client update carrying ticket 04 is live on every channel you intend to support at cutover (web, itch, desktop as applicable).
4. In the admin panel → Policies, set the Privacy Policy to enabled. Do not bump the version.
5. Verify on a current build: log in as an existing account → prompt → accept → a like works.
6. Verify on an old build if one is available: any action shows "Formamorph needs updating to continue." That is the intended outcome.
7. Append the changelog entry (⚙️ Backend group: Signals, Privacy Policy, deletion; 👤 entry: the prompt and the deletion flow).

## Acceptance

- Steps 5 and 6 observed and noted in this ticket's Comments with the date.
- The policy stays enabled.

## Rollback

Disable the policy in the admin panel. Nothing else is needed; collection continues under legitimate interest with the public page live.
