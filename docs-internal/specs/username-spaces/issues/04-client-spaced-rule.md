# 04: Client Spaced Rule

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low
Spec: ../spec.md (Q2, Q9, Q11)

## What to build

The client username rule accepts single inner spaces. It trims the ends and collapses each run of spaces into one, then checks the rule, and sends the collapsed name. The help line reads "3–20 letters, numbers, spaces, _ or -". The game's Register dialog, the site's Create Account page, the game's rename dialog and the site's rename page all show it, because they read the one rule module.

The 3.5.0 changelog section never shipped. Edit its Usernames entries in place to state the new rule, with no "now" or "no longer".

## Acceptance criteria

- [ ] The rule table covers: a single inner space (valid), a doubled space (collapsed, valid), a leading or trailing space (trimmed), a space next to `_` or `-`, and a 20-character name with spaces.
- [ ] The verdict's `username` is the collapsed name.
- [ ] The register page and the rename dialog render the Q11 help line.
- [ ] The 3.5.0 Usernames entries state the spaced rule.
