# 02: Rule on Register Forms

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q1, Q3, Q9, Q10)

## What to build

The game's sign-up dialog and the site's register page apply the username rule before submit. Both show the help line "3–20 letters, numbers, _ or -" under the **Username** field. Both trim the typed name and show the same text as the error. This ticket owns the shared client rule module. Ticket 06 reuses it.

## Acceptance criteria

- [ ] One shared client function decides the rule and exports the help text. The game and the site both import it.
- [ ] A table test covers boundary lengths, inner spaces, a dot, non-ASCII letters and `[deleted user]`.
- [ ] The game's sign-up dialog and the site's register page show the help line and refuse a bad name before any request.
- [ ] A trailing space is trimmed before the check and before the request.
- [ ] The server's `USERNAME_TAKEN` refusal shows as a "name taken" error on both surfaces.
- [ ] The **Register** row on the Community Creations wiki page states the new rule.
- [ ] A changelog fragment describes the rule.
