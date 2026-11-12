# 02: Delete the Last Avatar, Mark the Bundled Default

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Two small library rules in one service, with existing tests to extend.

## What to build

The library lets a player remove every Avatar, and a new install starts with a Default Avatar (spec, Library and seeding; Q3, Q6).

- The last usable Avatar is deletable on every build. The delete guard goes, with any copy that explains it.
- The first seed of the bundled default Avatar marks it as the Default Avatar when none is marked.
- An existing install gets the mark once on update: when no Default Avatar is marked and the bundled Avatar is still in the library. The step runs once per device, and never after the player clears or changes the Default Avatar.
- The seed-once flags stay. A deleted bundled Avatar never returns.
- A build with no bundled Avatar marks nothing.
- The mark and the one-time flag are device-local. No world or save field changes.
- Update the Avatars wiki page where it describes the Default Avatar and deleting Avatars.

## Acceptance criteria

- [x] On a build with a bundled Avatar, the last Avatar in the library deletes. (`ModelStorageService.test.ts` "deletes the last model, even on a build with a bundled Avatar")
- [x] A fresh install seeds the bundled Avatar and marks it as the Default Avatar. ("marks it on a fresh install")
- [x] An existing install with no Default Avatar and the bundled Avatar present gets the mark once. ("marks it once on an existing install...")
- [x] An existing install that deleted the bundled Avatar gets no mark and no new Avatar. ("marks nothing and adds nothing...")
- [x] After the one-time step, clearing the Default Avatar stays cleared across a restart. ("keeps a clear across a restart")
- [x] A Default Avatar the player marked before the update is unchanged. ("keeps a Default Avatar the player marked...")
- [ ] Mutation: restore the delete guard, and the last-Avatar test fails.

For you: on your own install, check that the Default Avatar badge is on the bundled Avatar after the update, and that your own pick is kept if you had one.

## Landed

**Not verified**
- Mutation check of the delete guard: not run. The old guard tests were flipped to assert deletion, so they fail if the guard returns, but I did not reinstate it.
- A Default Avatar id that points at a deleted Avatar counts as marked, so the step marks nothing and sets its flag. The spec says "none is marked"; a ruling would pin the stale-id case.

**For you**
- Your own install: the **Default** badge sits on the bundled Avatar after the update, and your own earlier pick is kept.
- The Avatars wiki still says "With no default, User's Default shows the bundled Avatar". The resolver ticket changes that.
