# 01: Server Rule at Registration

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q1, Q3, Q5, Q9); server spec: Registration

Repo: FormamorphServer

## What to build

Registration trims the typed name. It then refuses the name unless the name is `[A-Za-z0-9_-]{3,20}` and no other account holds it ignoring case. Refusals carry a `code` that the client can act on. This ticket owns the server's one rule check. Ticket 03's rename route reuses it.

## Acceptance criteria

- [ ] A name outside the pattern is refused with `code: 'USERNAME_INVALID'` and the rule text "3–20 letters, numbers, _ or -".
- [ ] A name that matches an existing account ignoring case is refused with `code: 'USERNAME_TAKEN'`.
- [ ] A leading or trailing space is trimmed before the checks, and the account is stored trimmed.
- [ ] The rule check is one exported function that ticket 03 can call.
- [ ] The server README's register route section states the rule and the two codes.
