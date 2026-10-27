# 04: Server Rename Gate

Status: done
Base: 0a8d6b7
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q12); server spec: Gate, Cutover

Repo: FormamorphServer

## What to build

A server setting controls the gate. When the setting is on, `protect` refuses a flagged account's non-GET requests with 403 `{ code: 'USERNAME_RENAME_REQUIRED', error: 'Update Formamorph to choose a new username.' }`. The setting ships off. The operator turns the gate on after the client release that answers the code.

## Acceptance criteria

- [x] With the setting on, a flagged account's write is refused with the code, and its GET passes. (`refuses a flagged account's write with the code while on, and lets its read pass`)
- [x] The Privacy Policy refusal answers before the rename refusal. (`answers the Privacy Policy refusal first`)
- [x] The rename route, account deletion and the routes that already skip the policy gate pass for a flagged account. (`lets the rename route, password change and account deletion through`, `lets the policy routes through`)
- [x] With the setting off, the gate refuses nothing. (`ships off: a flagged account writes as before`)
- [x] The server README documents the setting and the refusal code.

## Landed

**Not verified**

- None. Every criterion is ticked.

**For you**

- Setting key is `username_rename_gate` (admin-only, boolean, default false). Turn it on with `PUT /api/settings/username_rename_gate` after the client release.
- Order is Privacy Policy, then suspension, then rename (spec session answer). The rename route still refuses a suspended account.
- The gate also covers `POST /api/messages/:id/read` and `DELETE /api/messages/:id` (`protectAllowSuspended`). They do not skip the policy gate, so they follow the spec's exemption rule. A flagged account cannot dismiss a message until it renames.
