# Spec: Username Spaces

Status: done
Spec session: username-spaces — spec
Status note: Closed 2026-10-27. Tickets 01–05 done; last landing 3078f867c4 (server). Review: spec text corrected (Q17 order). Gates green on 2026-10-27.

Server side: the FormamorphServer repo, `docs-internal/specs/username-spaces/spec.md`. It holds the folded key, the re-flag pass and the lookup contract. This spec holds the rulings (Q1–Q11) and the user stories.

Follows `docs-internal/specs/username-charset/` (closed). Reopens its Q1 (the character set) and Q5 (uniqueness). Its Q4 (the mention grammar) stands.

## Problem Statement

The username-charset rule allows only `[A-Za-z0-9_-]`, so a name with an inner space, such as "Jake James", must rename. The live server flagged 136 such accounts in the handover count. Most sites allow these names and treat the space and `_` as the same character, so `@Jake_James` reaches "Jake James".

## Solution

A username is 3–20 ASCII letters, digits, `_`, `-` or single inner spaces. The client and the server trim the ends and collapse each run of spaces into one before the check.

Every comparison folds the name: ASCII lowercase, and a space reads as `_`. Uniqueness, mention resolution, username search and profile lookup all use that fold. So "Jake James" and "jake_james" are one name, and `@Jake_James` mentions "Jake James". The name is stored and shown as typed.

A new server pass clears the flag on accounts that pass the new rule. It never flags a name that passed the old rule.

## User Stories

1. As a new player registering, I want to use a name with a space, such as "Jake James", so that I can keep the name I use elsewhere.
2. As a new player, I want "Jake  James" to become "Jake James" before the check, so that a double space is not an error.
3. As a new player, I want "Jake_James" refused when "Jake James" exists, so that nobody can pose as that player.
4. As a new player, I want the help line to list spaces, so that I know they are allowed.
5. As a player flagged only for an inner space, I want the flag cleared, so that I keep my name and never see the rename dialog.
6. As a player whose name passed the old rule, I want to keep it, so that the new rule never takes a name away.
7. As the newer of two flagged twins that now fold to one name, I want to be asked to rename, so that mentions reach one account.
8. As a player mentioning someone with a space, I want `@Jake_James` to reach "Jake James", so that every name can be mentioned.
9. As a player typing `@`, I want suggestions to insert the underscore form, so that the inserted mention works.
10. As a reader, I want a mention chip to show the stored name, "Jake James", so that I see the name the player chose.
11. As a player sharing a profile, I want the link to read `/u/Jake_James`, so that it has no `%20`.
12. As a reader of an old `/u/Jake%20James` link, I want it to open the same profile, so that old links keep working.
13. As a player searching for "jake_james" or "jake james", I want to find "Jake James", so that search matches the way mentions do.

## Implementation Decisions

- **Rulings (grill, 2026-10-27).**
  - Q1: The flag pass already ran on the live server. Its gate setting is off, so it refuses nothing, but flagged accounts are out of mentions and search today.
  - Q2: Trim the ends and collapse each run of spaces into one, then check. This extends username-charset Q9.
  - Q3: Names that fold to the same key are twins. The oldest keeps the name, as in username-charset Q11.
  - Q4: The mention grammar stays `[A-Za-z0-9_-]{3,20}`. `@Jake_James` resolves to "Jake James". Suggestions insert the underscore form. The chip shows the stored name.
  - Q5: Withdrawn. The server gate setting is already off, and no Admin Panel control exists for it.
  - Q6: The new pass clears the flag on every name that passes the new rule and has no twin. A name that passed the old rule is never newly flagged. In a twin group, a name that passed the old rule keeps the name. When every twin was flagged, the oldest keeps it.
  - Q7: Profile links use the underscore form. The lookup folds, so an encoded-space link opens the same profile.
  - Q8: Username search folds space and `_`.
  - Q9: One effort. Server and client tickets land before 3.5.0 is cut again. The 3.5.0 release was canceled, so no player has the 3.5.0 client.
  - Q10: username-charset Q14 stands. A completed rename is final.
  - Q11: The help line reads "3–20 letters, numbers, spaces, _ or -".
  - Q12 (tickets, 2026-10-27): The client helper for links and mention inserts turns each space into `_` and keeps the stored capitals: "Jake James" → "Jake_James". The lowercase fold is the server's, for lookups only.
  - Q13 (ticket 04, 2026-10-27): Only U+0020 runs collapse; tabs and other whitespace stay invalid. Ticket 04 writes no changelog fragment; the spec session edits the 3.5.0 Usernames entries on main after it lands.
  - Q14 (ticket 01, 2026-10-27): `username_key` is a VIRTUAL generated column (`replace(lower(username), ' ', '_')`) with a non-unique index, so no writer sets it. Lookups fold the argument with the same SQL expression. The feedback mention search's character filter admits spaces in ticket 01; the rename flag hides live spaced names until ticket 03.
  - Q15 (ticket 01, 2026-10-27): World search by author is a username search under Q8 and folds. Forgot password by name stays byte-exact, like sign-in.
  - Q16 (ticket 05, 2026-10-27): The `@` suggestion run keeps the Q4 grammar, so a typed space ends it. `@Jake_J` suggests "Jake James" through the server's folded prefix match.
  - Q17 (ticket 02, 2026-10-27): The server rule matches the client's: trim all whitespace at the ends, collapse U+0020 runs, length 3–20 counted after the collapse, then `^[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$`. The old pattern stays frozen for the old flag step and ticket 03. The rename suggestion drops outside characters, collapses spaces, slices to 20 and trims again, so a dropped character never costs a letter at the cut.
  - Q18 (ticket 03, 2026-10-27): In Q6, "passed the old rule" means unflagged before the pass. In an all-flagged group, the oldest member whose stored name passes the new rule keeps it; members that fail the new rule stay flagged. The pass runs in the key step's add-run, so it runs once when the key column is added.
- **Rule module.** `src/lib/usernameRule.ts` stays the one client rule. `checkUsername` trims, collapses space runs, then checks the new pattern. `USERNAME_RULE_HELP` takes the Q11 text. The site and the game read it as before.
- **Link-form helper.** One client function turns each space into `_` and keeps the capitals (Q12). The mention suggestion insert and the profile link builders use it. The server owns every lookup; the client never resolves a name itself.
- **Mention suggestions.** The `@` suggestion list inserts the link form of the picked name. The chip renders the account name the server returns.
- **Profile links.** Every `/u/<name>` link the client builds uses the underscore form of the stored name, in its stored capitals.
- **Changelog.** The 3.5.0 section never shipped. The Usernames entries in it are edited in place to state the new rule, with no "now" or "no longer".

## Testing Decisions

- Tests exercise behavior through public surfaces: the rule function's verdicts, rendered components, and HTTP replies. No test reads a private helper.
- The rule function's table gains: a single inner space (valid), a doubled space (collapsed, valid), a leading or trailing space (trimmed), a space next to `_` or `-`, and a 20-character name with spaces. Prior art: the username-charset rule table.
- The mention suggestion test picks a spaced account and asserts the inserted text is the underscore form. Prior art: the feedback-links suggestion tests.
- The profile link test asserts a spaced name builds `/u/Jake_James`.
- The register page and the rename dialog show the Q11 help line.

## Out of Scope

- Non-ASCII letters, dots and other symbols. They stay outside the rule.
- A general "change my username" feature (username-charset Q14).
- Redirects from names freed by a rename (username-charset Q13).

## Further Notes

- The server deploys on its own, but Q9 holds it with the client tickets, so the rule never differs between the two.
- Sign-in matches the stored name byte for byte (username-charset Q8). A player signs in as "Jake James", not "Jake_James".
