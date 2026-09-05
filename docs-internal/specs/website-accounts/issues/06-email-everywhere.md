# 06 — Email everywhere

Status: ready-for-human
Spec: ../spec.md

**What to build:** A player adds an optional email when registering on the site or in the app. On `/account` they set or replace it, see whether it is verified, and resend the mail. The link in the mail lands on `/verify-email` and confirms the address.

**Blocked by:** 05; server ticket 02.

- [x] Optional email field on the site register page and the app's register modal, with the taken-email error shown.
- [x] Email section on `/account`: current address, verified state, set or replace, resend.
- [x] `/verify-email` consumes the token and shows success, or an expired-link message with a resend path.
- [x] jsdom tests for both forms and the account section; a test for the verify page in both outcomes.

## Comments

Built against the routes server tickets 01 and 02 shipped: `POST /api/auth/email`,
`POST /api/auth/resend-verification`, `POST /api/auth/verify-email`, and the `email` / `emailVerified`
fields on `/api/auth/me`.

**The register refusal was being swallowed, and the taken-address box could not have worked without
fixing it.** `AuthService.register` read the refusal from `errorData.message`; this API answers in
`error`. So a 409 `EMAIL_TAKEN` came out as "Registration failed" — and so did a taken *username*, which
has been true since before this ticket. Both now show the server's own sentence, because the two name
different fixes: pick another name, or recover the account holding the address. `login` still reads
`message` and so still says "Login failed" for a wrong password. Left alone as outside this ticket, and
worth its own pass.

**`fetchEmailState` is a separate read, not `fetchUserProfile`.** The account page reads the account on
arrival, because a session held since before the field existed carries neither the address nor its
state and would render "no email on file" for somebody who has one. `fetchUserProfile` replaces the
cached record *wholesale*, so an arrival read landing after the reader removed their avatar would put
the old avatar back — a real race, caught by an existing avatar test going red. The new method reads
the two fields and writes nothing.

**🐞 `verifyEmail` stamped the wrong account.** Found in review: the link is opened wherever the mail
was read, which on a shared computer may be a browser signed in as somebody else. Adopting
unconditionally wrote `emailVerified: true` onto that account's record against an address it does not
hold. It now adopts only when the held address folds to the proven one.

**The verify page guards against StrictMode.** The token is single use, so the second effect run would
answer `TOKEN_INVALID` and turn a good link into a dead one before the reader saw it work. A ref, not
state — it has to be true before the next render. Proven by rendering the page inside `StrictMode` and
by removing the guard to watch the test go red.

**A spent link and a server that never answered are two outcomes, not one.** `verifyEmail` returns a
discriminated result rather than throwing: a fresh mail fixes a spent link and does nothing for an
outage, and told the same way the reader spends one of a small mail budget on a problem it cannot
touch. The spent page offers Resend (or a sign-in first, since asking needs a session); the outage page
says to open the same link again.

`NoteLine` moved out of `AccountPage` into `site/components/NoteLine.tsx`, so both pages answer the same
way. The site still mounts no toast container, for the reason ticket 05 records.

Live-checked against a scratchpad mock API on the site dev server: register with the field, save an
address, the unverified state and its Resend, a good link, the same link a second time, the signed-out
spent link, and the account page at 375px. The app's register modal was checked in the game, showing
the box in register mode and not in login mode.

**Not built here:** the Forgot password link in the login modal and on `/login` — that is ticket 07,
which owns `/reset-password`. The privacy policy still says the address is not mailed; server ticket 01
flagged it and it is a server-side row, not a client change.
