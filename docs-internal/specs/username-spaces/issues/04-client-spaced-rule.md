# 04: Client Spaced Rule

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q2, Q9, Q11)

## What to build

The client username rule accepts single inner spaces. It trims the ends and collapses each run of spaces into one, then checks the rule, and sends the collapsed name. The help line reads "3–20 letters, numbers, spaces, _ or -". The game's Register dialog, the site's Create Account page, the game's rename dialog and the site's rename page all show it, because they read the one rule module.

The 3.5.0 changelog section never shipped. Edit its Usernames entries in place to state the new rule, with no "now" or "no longer".

## Acceptance criteria

- [x] The rule table covers: a single inner space (valid), a doubled space (collapsed, valid), a leading or trailing space (trimmed), a space next to `_` or `-`, and a 20-character name with spaces. (`usernameRule.test.ts` rows, 23 passing)
- [x] The verdict's `username` is the collapsed name. (`collapses a doubled space…` test)
- [x] The register page and the rename dialog render the Q11 help line. (`RegisterPage.test.tsx` and `RenamePage.test.tsx` assert the new text; both pass)
- [x] The 3.5.0 Usernames entries state the spaced rule. (spec session edits them on main)

## Landed

**Not verified**
- 3.5.0 Usernames changelog entries: changelog edit done by spec session after landing (Ticket 04 ruling; no fragment written).
- Full `test` and `build` gates run in prepare; only typecheck, changed-file lint and affected node tests ran before.

**For you**
- Type "Jake  James" in the Register dialog and on the site's Create Account page: it should be accepted, and the help line should list spaces.
- `docs/Community-Creations.md` line 405 now lists spaces in the Register rule.
