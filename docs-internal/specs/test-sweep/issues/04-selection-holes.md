# 04: Selection Holes

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Rationale: A small code change; the judgment is in auditing the hand-kept lists.

Parent: [Test Sweep spec](../spec.md)

## What to build

Known gaps in affected-test selection close before anything else changes it (Q2). A deleted file must count toward path triggers: today, deleting a doc or world fires none. Audit the always-run, graph-covered and path-trigger lists against what each test really reads, and fix or remove wrong entries.

Check the working tree before editing the selection scripts, because another session had uncommitted edits there on 2026-11-01. This ticket does not narrow selection.

Rulings: Q2, Q21, Q26.

## Acceptance criteria

- [x] Deleting a file matched by a path trigger selects that trigger's tests; a test proves it, and removing the fix turns it red. `the affected-test listing` runs the real script in a real git repo; filtering deleted files back out turned 5 of its 6 tests red.
- [x] Each audited list entry was checked, and the changes are listed in the ticket. See "Audit" below; a second agent repeated the audit and found no uncovered reader.
- [x] No test that was selected before leaves the selection for an unchanged input, except a listed wrong entry. Old and new `relatedFiles` compared on all 6,533 tracked paths: 0 lost, 7 inputs gained tests. Always-run keys are unchanged.

## Audit

Every entry on the three lists was read against the file's disk reads: 28 always-run, 44 graph-covered, and each path-trigger target.

**Selection code**

| Change | Why |
|---|---|
| `affectedTests.mjs` uses `touchedSince` | Deleted files reach the path triggers. `vitest related` accepts a missing path, checked by running it. |
| `touchedSince` passes `--no-renames` | Git hid a renamed file's old path, so moving a doc or world fired nothing. The build gate shares this helper, so it now sees the old path too, which can only force more builds. |
| The CommonJS read skips missing files | A `.cjs` deleted in the working tree crashed the listing. |

**Wrong entries**

| List | Entry | Change |
|---|---|---|
| Graph-covered | `scripts/fetchLlamaServer.test.mjs` | Removed. It reads its asset list by path, so the graph never covered it. |
| Graph-covered | `scripts/fetchLlamaServer.mjs` | Removed. It reads the pin by path, and the pin's trigger missed it. |
| Path trigger | `scripts/llamaServerPin.json` | Adds `scripts/fetchLlamaServer.mjs`. |
| Path trigger | `scripts/fixtures/llamaServerAssets.*.json` | New; selects `scripts/fetchLlamaServer.test.mjs`. |
| Path trigger | The three bundled `.vrm` files | Add `scripts/shipNotices.test.ts`, which checks that each avatar the notices name exists. |
| Path trigger | `vite.site.config.js` | New; `scripts/shipNotices.test.ts` reads it. |
| Path trigger | `legal/notices-map.json` | New; `scripts/shipNotices.test.ts` reads it through the real root. |
| Always-run | `searchNaming.test.ts` | Reason corrected: it reads `helpSpeaker.ts`, not `AskParts.tsx`. |

**Left as is**

- The `FullscreenShell` reason is stale and the `personaReaders` reason is incomplete. Ticket 14 removes the first and rewords the second.
- `bundledDocsIndex.test.ts`, `emberwatchWorld.test.ts`, `openChatWorld.test.ts` and `package-lock.json` have trigger entries that another rule already covers. They are redundant, not wrong, and removing them is narrowing.
- The lists guard only checks that a disk reader is classified, so a trigger target that later reads a second file passes unnoticed. This is a gap for ticket 13 or 19 to weigh.

## Landed

**Not verified**

- Nothing left unticked.

**For you**

- Nothing needs a player's eye; this is gate tooling.
