# 08: Community

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: player-facing listing, likes and contest copy with the controlled publish terms.

## What to build

Sweep the copy of Community Creations and contests under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- `src/components/community/`, `src/components/events/`
- `src/views/CommunityCreationsBrowser.tsx`
- In `src/components/menu/`: `ContestEntryCard`, `PodiumDialog`, `WebVersionChangelog`
- `src/lib/addonReview.ts`

**Notes**

- Listing, source, required, add-on, Public and Unlisted are controlled terms. Use their meanings from the Writing Guide.

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. String extract of all 38 files plus the R28 lib files; facts checked against the code; spec review found no false fact after the age gate fix.
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. copy:sweep raw-hint-role 56 → 14, all 14 triaged.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. Renames listed below; grep of tests, e2e and docs for each old string.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). One comment: `CommunityFilterBar.tsx` lost "lands" and "gives way".
- [x] Every test that pinned a changed string is updated. Affected community, events, browser, publish, review and lib suites green; review gates green.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. No code bug fixed in place.
- [x] No changelog fragment.

For you: Open the Community browser, a world's details, the likes dialog and a contest, and read the help text.

## Landed

**copy:sweep, ticket files (40):** 112 notices before, 48 after. The seven R28 lib files: 0 after.

| Rule | Before | After |
|---|---|---|
| raw-hint-role | 56 | 14 |
| label-case | 23 | 19 |
| period-shape | 10 | 6 |
| uncontracted | 7 | 3 |
| ellipsis | 7 | 0 |
| label-parenthetical | 3 | 3 |
| figurative | 2 | 2 |
| em-dash | 2 | 0 |
| term-character | 1 | 0 |
| long-sentence | 1 | 1 |

**Triage of what remains**

- raw-hint-role: section headers in the filter and Hidden popovers and the Bursts header; the VPN, Claimed and network badges; rows that hold controls (the changelog date with its edit buttons, a comment's header, the creations and likes metadata rows). None is help.
- label-case: case-only drift (Q5 nit).
- period-shape: status lines with a subject keep their period ("No likes yet.", "This world requires nothing."); the attestation sentence (R30).
- uncontracted, figurative, long-sentence: the attestation sentence (R30); "Some of it is adult content" and "stay as they are" read wrong contracted; "live version" is the term the review copy in `listingModeration.ts` uses.
- label-parenthetical: counts in labels are data (R32).

**Renames (R14: every quote updated)**

- "What changed" → "What Changed": the changelog body's accessible name now matches its visible label. Changelog, pending update and publish tests.
- "Clear all" → "Remove All Likes" on a profile's Likes tab, the name its confirm and toast use. `UserProfileDialog.likes.test.tsx`.
- "Delete world" → "Delete <kind>" and "Hide this world" → "Hide this <kind>" on listing cards; "Hide all worlds by" → "Hide everything by". Hiding and deleting act on every kind.
- Hidden popover: "Worlds" → "Listings", "Unhide world" → "Unhide <name>".
- Quarantine length select: accessible name "Quarantine length" → "Delete it after", its visible label. Review decision and Review tab tests.
- Report dialog: "Anything else (optional)" → "Anything else" with an "Optional" Hint (R25).
- Placeholders: "author…", "tag…", "model…" → "Add an author/tag/model" in the filter, "Hide a tag/an author" in Hidden; "Leave a comment..." → "Write a comment" (`docs/Community-Creations.md`).
- Contest status: "Closed … — being judged" → "Closed … · Judging", "Won by X — author" → "Winner: X by author" (`docs/Community-Creations.md`).

**Drive-by corrections**

- Confirm dialogs name their action instead of "Confirm": Delete (changelog entry, comment, published listing), Remove (likes), Discard (unsaved add-on reviews), Write Message (takedown notice).
- The age gate's decline line said "nothing else changes". Decline also signs the player out; the line says so. The lead said "characters" and named three kinds; it names the six the browser holds (R30).
- The quarantine dialog said "the administrators" can see a quarantined listing and "updating buys another week". Staff can see it; an update moves the deadline back one week, once.
- A profile with no username read "They hasn't published anything yet"; it reads "This account hasn't…".
- The empty contest told players to turn on "the contest switch"; it names the switch, **Enter into <contest>**.
- A download source error called an entity a "character".
- `src/components/WorldDetails.tsx` (ticket 01's file, R33): the tag tooltip "Hide all worlds tagged" → "Hide everything tagged"; hiding a tag hides every kind.

**In-place bug fixes:** none.

**Findings**

- Hints after their control (Field help order, R15): the changelog Date hint and the quarantine length note.
- `src/views/CommunityCreationsBrowser.tsx` and the card: the like button's accessible names use an em-dash ("Like — 3 likes"). Q5 leaves them; the design-system reference tests pin them too.
- `site/bundleBoundary.test.ts`: the site's age gate and creations list now read the typography roles, so its module ceiling rose from 72 to 73, with its line.

**Not verified**

- No rendered read of the Community screens. The tests read the DOM; nobody looked at the screens.

**For you**

- Open the Community browser, a world's details, the likes dialog and a contest, and read the help text.
- The age gate's lead and decline line changed; the attestation sentence did not, so `AGE_GATE_VERSION` stays 1.
- Confirm buttons now read Delete, Remove, Discard or Write Message instead of Confirm.
