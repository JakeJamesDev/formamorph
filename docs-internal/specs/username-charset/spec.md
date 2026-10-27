# Spec: Username Character Rule

Status: done
Status note: Closed 2026-10-27. Tickets 01–09; last landing f7d26972a. Review: spec text corrected; cleanup landed as tickets 08–09. Gates green on 2026-10-27.
Spec session: username-charset — spec

Server side: the FormamorphServer repo, `docs-internal/specs/username-charset/spec.md`. It holds the flag, gate and rename contract. This spec holds the rulings (Q1–Q18) and the user stories.

## Problem Statement

The server limits a username to 3–20 characters and sets no character rule. Feedback mentions (feedback-links spec, Q32) parse `@` + `[A-Za-z0-9_-]{3,20}`, so:

- A name with a space or any other character cannot be mentioned or suggested.
- A name with a dot links only the part before the dot. `@ann.lee` mentions an account named `ann` if one exists.

Uniqueness compares names byte for byte, so `Alice` and `alice` are two accounts. Mentions and profile links fold case, so one of the two can never be reached by name.

The 2026-09-03 handover data holds 5,521 accounts. 376 names break the token set: 89 only by a leading or trailing space, 136 with inner spaces, 69 shaped like email addresses, 25 with non-ASCII letters, and 57 with other symbols. 118 groups of names differ only by case.

## Solution

Every new username follows one rule: 3–20 ASCII letters, digits, `_` or `-`, unique ignoring case. The server enforces it, and the site and the game show it under the username field before submit.

Existing accounts that break the rule must choose a new name. The same applies to every account in a case-twin group except the oldest. A flagged account still signs in with its old name. It then sees a rename screen, and it cannot use any account feature until it picks a valid, free name. The field starts with a cleaned suggestion. Local play in the game stays open.

Flagged accounts drop out of username search and mentions, so `@alice` always reaches the account that keeps that name. An account that never signs in again keeps its old name.

## User Stories

1. As a new player registering, I want to see the username rule before I type, so that my first try succeeds.
2. As a new player registering, I want the error to state the same rule as the help line, so that I know what to fix.
3. As a new player, I want a stray leading or trailing space removed before the check, so that a typing slip does not fail my registration.
4. As a new player, I want a name that differs from an existing one only by case refused, so that nobody else can be confused with me.
5. As a new player on the website, I want the register page to apply the same rule as the game, so that the two never disagree.
6. As a player with a rule-breaking name, I want to sign in with the name I always used, so that I am not locked out.
7. As a player with a rule-breaking name, I want a rename screen right after sign-in, so that I know what is needed and why.
8. As a player with a rule-breaking name, I want a suggested name already in the field, so that one click can finish the rename.
9. As a player whose suggestion is taken or invalid, I want an empty field, so that I do not get a suggestion that fails.
10. As a player renaming, I want the same rule and the same error text as registration, so that I learn one rule.
11. As a player renaming, I want to be told when a name is taken, ignoring case, so that I can pick another.
12. As a player already signed in when the rule ships, I want the rename screen on my next account action, so that my open session does not fail in an unclear way.
13. As a flagged player in the game, I want local play to keep working, so that a rename never blocks me from playing.
14. As a flagged player in the game, I want the rename dialog when an account action is refused, so that I can rename in place.
15. As a flagged player on the website, I want the website to send me to the rename page, so that I can rename there too.
16. As a flagged player, I want my listings, likes, follows and comments to show my new name after the rename, so that my history stays mine.
17. As a flagged player, I want to sign in with my new name after the rename, so that the change is complete.
18. As the newer account in a case-twin pair, I want to be asked to rename, so that mentions and profile links reach me.
19. As the oldest account in a case-twin group, I want to keep my name unchanged, so that the migration does not touch me.
20. As a player who mentions `@alice`, I want the mention to reach the account that keeps that name, so that the right person is badged.
21. As a player typing `@`, I want suggestions to list only names that can be mentioned, so that every suggestion works.
22. As a reader of an old `/u/<oldname>` link, I want a "not found" page after the rename, so that the link never reaches someone else.
23. As a player who never signs in again, I want to keep my old name, so that nobody assigns me a name I did not choose.
24. As a moderator, I want staff logs and report snapshots to keep the name as recorded, so that the record matches what I saw.
25. As a moderator, I want the account id in a log to lead to the current account, so that I can find a renamed player.
26. As a reader of a deleted account's content, I want `[deleted user]` to keep showing, so that the deletion placeholder is not flagged.
27. As a player on an older game build, I want the server's refusal to tell me to update, so that I know how to continue.

## Implementation Decisions

- **Rulings (grill, 2026-10-27).**
  - Q1: A new username is `[A-Za-z0-9_-]{3,20}`, the same set as the feedback-links Q32 token.
  - Q2: Every existing account outside the rule must rename. The server trims and grandfathers no name.
  - Q3: The server is the authority. The site register page and the game's sign-up dialog check the rule before submit.
  - Q4: The Q32 mention grammar stays as it is.
  - Q5: New names are unique ignoring case.
  - Q6: The 69 usernames shaped like email addresses are a public-exposure problem for their own spec.
  - Q7: Replaced by Q2.
  - Q8: No sign-in workaround. A flagged account signs in with its old name, exactly as stored.
  - Q9: Registration and rename trim the typed name before the check.
  - Q10: The field shows the rule as a help line, and the error uses the same text.
  - Q11: The rename also covers every account in a case-twin group except the oldest.
  - Q12: The gate is hard on both the site and the game. The server refuses a flagged account's writes until it renames.
  - Q13: Old profile links and old mentions show "not found". The server keeps no alias table.
  - Q14: Only flagged accounts get the rename screen. A general username change is out of scope.
  - Q15: No deadline. A dormant flagged account keeps its old name. Username search and mention resolution skip flagged accounts.
  - Q16: In the game, the gate blocks account features only. Local play stays open.
  - Q17: The rename field is prefilled with a cleaned suggestion when that name is valid and free.
  - Q18: Staff logs and report snapshots keep the name as recorded.
  - Q19 (close): the game keeps its "Username changed to <name>" toast.
  - Q20 (close): the site keeps its one-time "Username changed" banner.
  - Q21 (close): message read and delete stay behind the rename gate.
  - Q22 (close): the review's duplication and naming findings land as tickets 08 and 09. The suspended exact-match mention pick is feedback-links Q34, not a defect.
- **One rule module, shared.** The game and the site share one client function for the rule, with its help text. Registration and rename use it. The server holds its own copy of the pattern.
- **Account payload.** The signed-in account carries a rename state: required or not, plus the server's suggestion or none. The client opens the rename screen from that state at sign-in and at app start.
- **Refusal watcher.** The game watches community-server replies for the rename refusal code, the same way it watches for the Privacy Policy refusal, and opens the rename dialog. The site handles the same code and sends the player to its rename page.
- **Rename call.** One authenticated call sets the new name. It applies the same rule and case-insensitive uniqueness as registration, and it works while the account is gated. On success the client refreshes the stored account and closes the screen.
- **Game gate surface.** A dialog over the current view, so local play continues underneath when the player closes it. No control on it unlocks account features without a rename. Ticket 06 intent answers: the buttons are **Save Username** and **Later**, with no Sign Out. After **Later**, the dialog reopens on the next sign-in, the next app start, and the next refused write. It waits while the Privacy Policy prompt is open. The shared call trims, checks the rule, posts the rename and adopts the returned account. The existing refusal watcher takes the code as a parameter, so no second copy exists.
- **Site gate surface.** A rename page on the account site. A gated session goes there after sign-in and on any refused write. Ticket 07 intent answers: the path is `/rename`, and a rename returns to `/account`. Page load never redirects; only sign-in and a refused write do. A signed-out visit goes to `/login`, and an unflagged one goes to `/account`. The buttons are **Save Username** and **Later**, the same as the game.
- **Copy.** Help line: "3–20 letters, numbers, _ or -". Every rule failure shows that same text. An empty field shows "Username is required". The client maps `USERNAME_TAKEN` to "That username is taken". In the game, the help line shows in register mode only. The rule module exports only the verdict, the help text and the error text, because the server owns the suggestion (ticket 02 intent answers). The rename dialog and page follow `docs/Writing-Guide.md` and the design system.

## Testing Decisions

- Tests exercise behavior through public surfaces: the rule function's verdicts, rendered components, and HTTP replies. No test reads a private helper.
- The rule function gets a table of valid and invalid names, including boundary lengths, `[deleted user]`, non-ASCII letters and inner spaces.
- The game's rename dialog: opens from the account state, opens from a refused reply, prefills the suggestion, shows the rule error, closes after a successful rename. Prior art: the Privacy Policy refusal and context tests.
- The site register page shows the help line and refuses a bad name before submit. Prior art: the existing register page tests.
- The site rename page: reached after sign-in of a flagged account, submits, then returns to the account page. Prior art: the account and reset-password page tests.

## Out of Scope

- Usernames shaped like email addresses as a privacy problem (Q6). Its own spec.
- A general "change my username" feature (Q14).
- Redirects from old names (Q13).
- Any change to sign-in lookup (Q8).
- A database-level unique index ignoring case. It cannot exist while dormant flagged twins remain.

## Further Notes

- Sign-in already matches the stored name byte for byte, so `Brian ` and the newer `alice` twin both sign in unchanged.
- A name that a rename frees either breaks the rule or is a twin name the oldest account still holds. So nobody else can take a freed name.
- The numbers in the Problem Statement come from the handover snapshot. The server's flagging step counts again on live data at deploy.
- Feedback-links tickets 03 and 08 own mention resolution and the username search. The server spec says how they skip flagged accounts.
