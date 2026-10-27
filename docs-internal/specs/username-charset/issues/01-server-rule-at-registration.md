# 01: Server Rule at Registration

Status: done
Base: 3629d45
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q1, Q3, Q5, Q9); server spec: Registration

Repo: FormamorphServer

## What to build

Registration trims the typed name. It then refuses the name unless the name is `[A-Za-z0-9_-]{3,20}` and no other account holds it ignoring case. Refusals carry a `code` that the client can act on. This ticket owns the server's one rule check. Ticket 03's rename route reuses it.

## Acceptance criteria

- [x] A name outside the pattern is refused with `code: 'USERNAME_INVALID'` and the rule text "3–20 letters, numbers, _ or -". `tests/usernameRule.test.js`: `refuses … with USERNAME_INVALID and the rule text` (8 cases incl. 2 and 21 characters).
- [x] A name that matches an existing account ignoring case is refused with `code: 'USERNAME_TAKEN'`. `refuses a name that differs from an existing one only by case`; mutation check (uniqueness disabled) turned it red.
- [x] A leading or trailing space is trimmed before the checks, and the account is stored trimmed. `trims a leading and trailing space and stores the trimmed name` reads the stored row.
- [x] The rule check is one exported function that ticket 03 can call. `checkUsername(name, { exceptUserId })` in `src/utils/usernameRule.js`; `checkUsername` describe block.
- [x] The server README's register route section states the rule and the two codes. README endpoint line, refusals table and a Username rule paragraph; read, not run.

## Landed

**Not verified**

- None. The full `npm test` gate ran green before the review fold-in.

**For you**

- None. Old clients now see `Username already exists` with `code: 'USERNAME_TAKEN'` on a taken name; the text is unchanged.
