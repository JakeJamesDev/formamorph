# 05: Privacy texts

Status: ready-for-human
Base: 43b0faaf
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium
Repo: FormamorphServer and formamorph
Spec: ../spec.md (User Stories › Privacy)

Model rationale: short, but it is legal-facing text that must match what the code does. It does not go to a smaller model.

## What to build

The server's Privacy Policy source text and the public privacy page both say what liking while signed out stores. The two texts match.

## Acceptance criteria

- [x] The text says: liking while signed out stores a random id for this copy of the app, a salted hash of the network address, and a coarse browser family.
- [x] It says the hash is kept 90 days, then blanked, and the like stays.
- [x] It says the hash is used only to limit and detect abuse.
- [x] It says how to remove an Anonymous Like: press the heart again on the same copy of the app.
- [x] It says that signing in moves those likes to the account.
- [x] The paragraph reads the same in both places. The user reviews the wording before it goes live.
- [x] Both "Last updated" stamps read 20 September 2026 (the user's ruling).
- [x] The public page gains the optional-email paragraph and the Resend processor paragraph from the server text, so the two texts match in full (the user's ruling). The hand-over names the paragraphs carried over.
- [x] The draft copy under the abuse-signals spec folder stays as it is; the hand-over names it as stale.
- [x] The policy version is not bumped by the agent; whether existing users see the prompt again is the user's call. Say so in the hand-over.

## Hand-over

Commits: FormamorphServer `5efeb05`; formamorph `c56d1cfe`, with the review follow-up in `9f76ddea`.

### What the texts now say

A new **Liking while signed out** section sits between **The Signal** and **Who else
handles your data**, in six paragraphs. It states the Install id, the salted hash and
the coarse browser family; that the id names the copy of the app and carries nothing
about the person or the device; that the hash is derived as a Signal's is and the
address is not stored; that the hash limits and detects abuse and nothing else uses
it; that the hash is blanked at 90 days while the like stays and still counts; how to
take a like back; and what signing in does. The retention list gains a matching line.

Every claim was checked against the code, not the ticket: `config/anonymousLikes`,
`AnonymousLike.blankHashesBefore`, `sweepRetention` sharing `Signal.cutoff`,
`InstallClaim` and its cascade on account deletion.

### Decisions the user owns

- **The policy version is untouched.** `acceptance_version` stays at 2. Whether
  existing users answer the policy again is the owner's call.
- **The live policy row does not change from this commit.** `schema/steps/privacyPolicy`
  inserts only when the row is absent, so the running server keeps the body it has.
  The new text reaches users when the owner pastes it into the Policies tab. The
  public page does deploy on merge.
- **The wording is for review before it goes live**, as the ticket asks.

### Paragraphs carried over to the public page

The page was a revision behind the server text. Three carried over, worded as the
server words them:

1. **Your email address is optional.** — verification and password-reset mail.
2. **Resend** delivers verification and password-reset email. — the processor the page
   did not name, which was the part that mattered.
3. "Except as described above, no one else receives your data." — replacing the bare
   "No one else receives your data."

Also `cancelled` → `canceled`, for American English.

A block-by-block comparison now reports the two files identical in full: 53 blocks
each, differing only by the page's `<h1>`.

### Blocker on the cutover

**The texts must not go live before server ticket 12 lands.** The removal promise —
"press the heart again on the same copy of the app" — is unconditional, and today the
route's `OFF` check and its visibility check both refuse a clear press. So a stored
Anonymous Like cannot be taken back once the operator uses the emergency stop, or once
the listing is hidden. The spec session ruled the promise stays unconditional and wrote
ticket 12 to make a clear press on a row the Install holds come before both guards.

### Stale copy, left alone

`docs-internal/specs/abuse-signals/privacy-policy.md` is the reviewed draft from that
closed effort. It is now two revisions behind both live texts. It is an artifact, not a
published text, so it stays as it is.

### Gates

| Gate | Result |
|---|---|
| client `typecheck` | 0 errors |
| client `lint` | 1 error, not this unit's: `guestLikes` unused in `CommunityCreationsBrowser.tsx`, another session's in-flight client work |
| client `build` | green, 1m 33s |
| client `npm test` | 20 failures, none this unit's: all in `useCatalogSync.test.ts` and `WorldStorageService.test.ts`, both mid-edit by another session. `changelogFormat.test.mjs` green, 14 tests |
| server `npm test` | 1662 tests green, 57.8s |

`bootSchema.test.js` gains five assertions on the new section. Proven to bite: deleting
the section fails it, and renaming the heading fails it.

### Named, not fixed

The policy text lives in two files in two repos with nothing keeping them level. The
6 September server revision never reached the page, and this ticket is the repair two
weeks later. A parity guard would need one repo to hold both texts, which is an
architecture call.

## Comments
