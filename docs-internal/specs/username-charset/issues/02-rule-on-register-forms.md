# 02: Rule on Register Forms

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q1, Q3, Q9, Q10)

## What to build

The game's sign-up dialog and the site's register page apply the username rule before submit. Both show the help line "3–20 letters, numbers, _ or -" under the **Username** field. Both trim the typed name and show the same text as the error. This ticket owns the shared client rule module. Ticket 06 reuses it.

## Acceptance criteria

- [x] One shared client function decides the rule and exports the help text. The game and the site both import it. (`src/lib/usernameRule.ts`; `SignInDialog`, `RegisterPage` and `AuthService.register` import it)
- [x] A table test covers boundary lengths, inner spaces, a dot, non-ASCII letters and `[deleted user]`. (`usernameRule.test.ts`; widening `{3,20}` to `{3,21}` turned "refuses twenty-one characters" red)
- [x] The game's sign-up dialog and the site's register page show the help line and refuse a bad name before any request. (`SignInDialog.username.test.tsx`, `RegisterPage.test.tsx`: no fetch, no policy read)
- [x] A trailing space is trimmed before the check and before the request. (`sends the trimmed name`, `sends the username without its trailing space`)
- [x] The server's `USERNAME_TAKEN` refusal shows as a "name taken" error on both surfaces. (both tests send the server's 400 body and read "That username is taken")
- [x] The **Register** row on the Community Creations wiki page states the new rule.
- [x] A changelog fragment describes the rule.

## Landed

**Not verified**
- Rendering of the help line in both themes and on mobile: no frame taken. It uses the same `text-meta text-muted-foreground` classes as the email hint beside it.

**For you**
- Open **Register** in the game's sign-in dialog: the help line sits under **Username** and is absent in **Login**.
- Open formamorph.ai `/register`: the hint under **Username** reads the new rule.
- Server ticket 01 must send `code: 'USERNAME_TAKEN'` for the "That username is taken" text to show; without the code the server's own text shows.
