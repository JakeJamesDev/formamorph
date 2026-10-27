# 02: Server Spaced Rule

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q2, Q11); server spec: Rule, Rename suggestion

Repo: FormamorphServer

## What to build

Registration and rename accept single inner spaces. The server trims the ends and collapses each run of spaces into one, then checks the new rule: 3–20 letters, digits, `_`, `-` or single inner spaces. The stored name is the collapsed form. The rule text the server returns reads "3–20 letters, numbers, spaces, _ or -".

A flagged account's rename suggestion keeps single inner spaces and drops only characters outside the new set.

## Acceptance criteria

- [ ] "Jake James" registers; "Jake  James" registers and is stored as "Jake James".
- [ ] A name with a space at either end is trimmed before the check.
- [ ] A space next to `_` or `-`, and a 20-character name with spaces, follow the rule table in the spec.
- [ ] A rename to "Jake_James" is refused with `USERNAME_TAKEN` when "Jake James" exists.
- [ ] The rename suggestion for a name with an inner space and an outside character keeps the space.
- [ ] A refused name returns the Q11 rule text.
