# 05: Underscore Links and Mentions

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q4, Q7, Q12)

## What to build

One client helper turns a stored name into its link form: each space becomes `_`, and the capitals stay (Q12). Every `/u/<name>` link the game and the site build uses it, so "Jake James" links to `/u/Jake_James` with no `%20`. A pick in the `@` suggestion list inserts the same form, so `@Jake_James` lands in the text. The mention chip still shows the name the server returns, "Jake James".

The server owns every lookup (tickets 01–03). The client never resolves a name itself. Blocked by 04 only because both edit the rule module and the Usernames changelog entries.

## Acceptance criteria

- [x] Every client builder of a `/u/` link uses the helper; a spaced name builds `/u/Jake_James`. (`feedbackProfileUrl`, the four site builders; tests in the links, OwnProfilePage and SupportersPage suites)
- [x] Picking a spaced account in the `@` suggestions inserts `@Jake_James`. (`FeedbackSuggestPlugin.test.tsx`, `feedbackSuggest.test.ts`)
- [x] A chip for a mention resolved to "Jake James" shows "Jake James". (`FeedbackThreadView.links.test.tsx`)

## Landed

**Not verified**
- The SiteAccountControls and FeedbackPage links use the helper but have no spaced-name test of their own.

**For you**
- None.
