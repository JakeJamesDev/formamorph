# 01: Server Folded Key

Status: done
Base: 22a3329
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q3, Q4, Q7, Q8); server spec: Folded key, Lookups

Repo: FormamorphServer

## What to build

Every account has a folded key: its name in ASCII lowercase, with each space read as `_`. A schema step adds the key and fills it for every row. Registration and rename write it with the name. An index on the key serves every lookup, but the index is not unique.

The uniqueness check, mention resolution, profile lookup and the username search (the users list filter and the feedback mention suggestions) all compare folded keys. So "jake_james" and "jake james" find the stored "Jake James", and `/u/Jake_James` and `/u/Jake%20James` open the same profile. Sign-in does not change.

This ticket does not change the rule. Spaced names stay flagged and out of mentions and search until tickets 02 and 03 land.

## Acceptance criteria

- [x] After the schema step, every row has a key equal to the fold of its name, and a second run changes nothing. (`usernameKey.test.js` › the schema step; `bootSchema` drift test)
- [x] Registration and rename write the key with the name. (`usernameKey.test.js` › writes carry the key)
- [x] A spaced account (seeded directly, unflagged) is found by its underscore form through mention resolution, profile lookup and the username search. (`usernameKey.test.js` › a spaced account: mentions, `/Jake_James` and `/Jake%20James`, users list, mention suggestions, world author search)
- [x] A registration of "jake_james" is refused with `USERNAME_TAKEN` when an account holds "Jake James". (`usernameKey.test.js` › uniqueness and sign-in)
- [x] Sign-in as "Jake_James" does not reach "Jake James". (`usernameKey.test.js` › signs in by the stored name only)

## Landed

The key is a virtual generated column (`username_key`) with a non-unique index. Lookups fold their argument with the same SQL expression (`foldedUsernameSql`). Spec-session rulings: mention suggestions admit unflagged spaced names, the world search by author folds, and forgot password stays byte-exact. Each lookup change was mutation-tested.

**Not verified:**
- None.

**For you:**
- None. The change is server-only and shows no player-visible effect until tickets 02 and 03 land.
