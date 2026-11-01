# CI Failures: Last 300 Runs

Measured 2026-11-01 from `ci.yml` runs, 2026-09-01 to 2026-11-01. 258 passed, 41 failed, 1 needed approval.

Each row comes from the failed job's log.

## Classes

| Class | Runs | Last seen | Read |
|---|---|---|---|
| 🧵 Unhandled error, often after teardown, every test green | 15 | 10-26 | Work that outlives its test. Mostly Sept. |
| 🎲 One test failed, next run green | 14 | 10-30 | Mostly waits and order under load. |
| 📌 `bundledRevisions.test.ts`: pinned commit missing | 4 | 10-27 | Fixed in this ticket. |
| 📄 Docs or changelog check on a contributor branch | 4 | 10-14 | Real breaks that CI caught. |
| 🧹 Lint | 3 | 09-14 | Real breaks. |
| ⏹️ Job canceled, no test ran | 1 | 10-05 | Not a failure of the suite. |

One run, 2026-10-26, had two causes: the pinned commit, plus a shard out of heap with a test timeout. It counts once, under the pinned commit.

## The repeat failure

- **Cause:** a pinned commit lived in source and again in a hand-kept list in `ci.yml`. A new pin passed locally, because a full clone has every commit, and went red only in CI's shallow clone.
- **Before this ticket:** v3.5.0 added the missing sha to the list. That fixed the trigger and left the cause.
- **Fix:** `scripts/pinnedCommits.json` is the one list, and `scripts/fetchPinnedCommits.mjs` fetches it. `ci.yml` holds no sha, a test proves it, and a lint rule stops a sha in source.

## Other repeat offenders

"Clean runs" counts green CI runs after the last failure. None was rerun locally (Q6, Q36).

| File | Failures | Last seen | Clean runs since | After the shard change |
|---|---|---|---|---|
| `src/lib/outputRun.pacer.test.ts` | 2 | 10-17 | 46 | ⚠️ yes |
| `src/lib/docs/docsCoverage.test.ts` | 3 | 10-14 | 60 | yes, real breaks |
| `src/lib/docs/docsReader.test.ts` | 2 | 10-14 | 60 | yes, real breaks |
| `scripts/changelogFormat.test.mjs` | 2 | 10-14 | 60 | yes, real breaks |
| `src/views/MainMenu.ageGate.test.tsx` | 3 | 09-29 | 163 | no |
| `src/components/menu/EventFormDialog.test.tsx` | 2 | 09-21 | 191 | no |
| `src/components/modals/SettingsModal.reasoning.test.tsx` (unhandled) | 5 | 09-20 | 194 | no |
| `src/components/community/RemoteWorldDetailsModal.comments.test.tsx` (unhandled) | 3 | 09-15 | 207 | no |
| `src/views/CommunityCreationsBrowser.contest.test.tsx` (unhandled) | 4 | 09-14 | 208 | no |

- The pacer test failed on 10-16 and 10-17. Two later commits changed how it waits: one bounds the wait by time, and one makes tests hold under load. It has not failed since, so this ticket leaves it alone.

## Doc and changelog breaks

- Three of the four ran on contributor `pr/*` branches, and the fourth is the merge of one of them to main.
- The failures were a 44-word changelog body, a broken docs link, and surface-map routes.
- Contributor clones do not have the ticket gates, so these never passed the affected gate. **No selection hole for ticket 04.**
- Today's selection covers them: `relatedFiles` selects `docsCoverage` and `docsReader` for a `docs/*.md` change, and `changelogFormat` is always run.

## Rerun records

- **Local:** `<git common dir>/test-reruns.jsonl`.
- **CI:** the `test-reruns-shard-N` artifact, uploaded by every shard. An empty file means no rerun, and a missing artifact means a lost record.
- **Write failure:** a rerun that cannot write its record is red.
- **Retention:** 90 days. Measured from this repo's release artifacts, created 10-29 and expiring 01-27. The settings API refuses this token, so the setting itself was not read.
