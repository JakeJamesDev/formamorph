# 03: Server Re-flag Pass

Status: done
Base: 413c7d8
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Q3, Q6); server spec: Re-flag pass

Repo: FormamorphServer

## What to build

A new schema step runs once and recomputes the rename flag under the new rule. A flagged account whose name passes the new rule and has no twin under the folded key loses its flag. In a twin group, the account whose name passed the old rule keeps the name and the others stay or become flagged. When no member passed the old rule, the oldest (`created_at`, then `id`) keeps it. The step never flags an account the old pass left unflagged, and never flags the placeholder.

At deploy on live data, a player flagged only for an inner space keeps the name and never sees the rename dialog.

## Acceptance criteria

- [x] A fixture database covers: a spaced name with no twin (cleared), a spaced name twinned with an unflagged underscore name (stays flagged), two flagged twins (oldest cleared, the other stays), a name still outside the rule (stays flagged) and the placeholder (never flagged). Test "clears the account that keeps each name and leaves the rest flagged" in `tests/usernameKey.test.js`; it also covers a stored double space that does not block the next valid twin, a flagged case twin and a same-second tie.
- [x] No account unflagged before the step is flagged after it. Test "never flags an account the old pass left unflagged".
- [x] The step runs once; a second schema run does not repeat it. Test "runs only in the run that adds the key".
- [x] A cleared account appears in mentions and the username search. Test "puts a cleared account in mentions and the username search" runs `migrate` on the app database.

## Landed

The pass runs in the `usernameKey` step's add-run (ruling 3), not as its own step. Mutation-tested: dropping the held-key check, the rule check, the `held.add`, or reversing the age order each fails the fixture test. Coverage of the step: 100% lines and branches.

**Not verified**

- None.

**For you**

- A dev database that already added `username_key` skips the pass. Its spaced accounts stay flagged until a rename.
- At deploy, the boot log prints `Schema: applied usernameKey`. Spaced players who were flagged only for the space should no longer see the rename dialog.
