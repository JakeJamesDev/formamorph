# 05: Underscore Links and Mentions

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q4, Q7, Q12)

## What to build

One client helper turns a stored name into its link form: each space becomes `_`, and the capitals stay (Q12). Every `/u/<name>` link the game and the site build uses it, so "Jake James" links to `/u/Jake_James` with no `%20`. A pick in the `@` suggestion list inserts the same form, so `@Jake_James` lands in the text. The mention chip still shows the name the server returns, "Jake James".

The server owns every lookup (tickets 01–03). The client never resolves a name itself. Blocked by 04 only because both edit the rule module and the Usernames changelog entries.

## Acceptance criteria

- [ ] Every client builder of a `/u/` link uses the helper; a spaced name builds `/u/Jake_James`.
- [ ] Picking a spaced account in the `@` suggestions inserts `@Jake_James`.
- [ ] A chip for a mention resolved to "Jake James" shows "Jake James".
