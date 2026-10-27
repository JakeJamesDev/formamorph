# 08: Client Rename Cleanup

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Spec: ../spec.md (Q22)

## What to build

The game's rename dialog and the site's rename page share one submit flow and one set of copy. The site has one helper for one-time account-page notices. Behavior does not change; the close review found the duplication.

## Acceptance criteria

- [ ] The dialog and the page call one shared submit helper: rule check, busy state, rename call, error text.
- [ ] The fallback error text and the intro sentence ("Formamorph has a new username rule…") each exist once, beside the rule in the shared rule module.
- [ ] The rename notice and the deletion-canceled notice use one generic one-time notice helper in the site, and the site layout renders both through it.
- [ ] The register retry paths in the site register page and the game sign-in dialog pass the checked name, the same as the first attempt.
- [ ] Sign-in no longer carries an unused `next` query to `/rename`, or the rename page honors it. Pick the removal unless a test or ruling needs the carry.
- [ ] The account path lives beside the rename path in the site router.
- [ ] The existing rename dialog, rename page, register and notice tests pass unchanged in what they assert.
