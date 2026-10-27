# 08: Client Rename Cleanup

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q22)

## What to build

The game's rename dialog and the site's rename page share one submit flow and one set of copy. The site has one helper for one-time account-page notices. Behavior does not change; the close review found the duplication.

## Acceptance criteria

- [x] The dialog and the page call one shared submit helper: rule check, busy state, rename call, error text. (`useRenameSubmit`)
- [x] The fallback error text and the intro sentence ("Formamorph has a new username rule…") each exist once, beside the rule in the shared rule module. (`USERNAME_RENAME_FAILED_MESSAGE`, `USERNAME_RULE_INTRO`; the intro's first clause only, since the tails differ by surface)
- [x] The rename notice and the deletion-canceled notice use one generic one-time notice helper in the site, and the site layout renders both through it. (`useOneTimeNotice`)
- [x] The register retry paths in the site register page and the game sign-in dialog pass the checked name, the same as the first attempt. (`checkedName` ref)
- [x] Sign-in no longer carries an unused `next` query to `/rename`, or the rename page honors it. Pick the removal unless a test or ruling needs the carry. (removed; LoginPage test expects `/rename`)
- [x] The account path lives beside the rename path in the site router. (`ACCOUNT_PATH`)
- [ ] The existing rename dialog, rename page, register and notice tests pass unchanged in what they assert. (no test edited except one bundle-boundary allowlist line; prepare's gates run them)

## Landed

**Not verified**
- Last criterion: tests run only in prepare's gates, after this note.

**For you**
- Nothing. No behavior change, except the dialog now shows the fallback text for an error with an empty message, as the page did.
