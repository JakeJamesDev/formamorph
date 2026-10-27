# 04: Server Rename Gate

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q12); server spec: Gate, Cutover

Repo: FormamorphServer

## What to build

A server setting controls the gate. When the setting is on, `protect` refuses a flagged account's non-GET requests with 403 `{ code: 'USERNAME_RENAME_REQUIRED', error: 'Update Formamorph to choose a new username.' }`. The setting ships off. The operator turns the gate on after the client release that answers the code.

## Acceptance criteria

- [ ] With the setting on, a flagged account's write is refused with the code, and its GET passes.
- [ ] The Privacy Policy refusal answers before the rename refusal.
- [ ] The rename route, account deletion and the routes that already skip the policy gate pass for a flagged account.
- [ ] With the setting off, the gate refuses nothing.
- [ ] The server README documents the setting and the refusal code.
