# 02: Live Entity Write on the Scripts Tab

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one write site moves inside an updater, with a test that proves the race it closes.

## What to build

The Scripts tab's write of an entity slice edits the entity as it is at that moment (spec: Scripts tab entity write; Q5). Today it replaces the entity with the copy it read when the edit began, so an entity edit that lands in the same tick is lost. The script edit now runs inside the entity setter's updater, on the live entity. Stats, traits and world scripts keep their per-record writers, and a write that spans homes still lands in one commit.

## Acceptance criteria

- [x] A test through the recorder or the editor history harness: an entity edit queued in the same tick as a Scripts tab script write survives, and the script write lands; proven by reinstating the replace-with-copy write. Verified: `WorldEditor.scriptsTab.test.tsx` "keeps an entity edit queued in the same tick"; it fails with the old write (name stays `Odd Wick`).
- [x] A Scripts tab write that touches two homes in one edit still commits as one Step. Verified: the existing "reorders within a timing ... undoes the drop in one step" test, which spans trait, world, stat and entity homes.
- [x] No changelog fragment: no player has reported the lost edit; the fragment is skipped unless the build finds a player-visible case, in which case add one under Fixed.

## Landed

**Not verified**
- None.

**For you**
- None. No player-visible case found, so no changelog fragment.
