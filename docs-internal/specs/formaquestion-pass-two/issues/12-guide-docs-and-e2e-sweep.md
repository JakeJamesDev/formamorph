# 12: Guide docs and e2e sweep

Status: ready-for-human
Blocked by: 02, 03, 04, 05, 06, 07, 08, 09, 10, 11
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The player docs and the e2e suite cover the second pass.

- The Formaquestion guide page gains how-to sections for Chat Style, the readability setting, Scale, the Mask handles, the scroll arrow, the Endpoint editor and the per-prompt options, and says Lookup Mode starts on.
- Docs edits move the AI Picks list; run the recall probe and report it.
- One e2e pass over the new controls, and the changelog lines for the effort.

Spec: all; Testing → Playwright.

Recommended model rationale: docs in the help voice and a sweep of existing e2e patterns.

## Acceptance criteria

- [x] Each new control has a how-to section in the help voice.
- [x] The recall probe result is in the ticket's Answer.
- [x] The e2e suite is green with the new checks.
- [x] The four gates are green.

## Answer

**Docs** (`docs/Formaquestion.md`). New how-tos, each with a keyword line and a route: Change the Chat Style, Make the Bare Chat Easier to Read (Scrim Opacity), Return to the Newest Answer (scroll arrow), Change the Size of the Mascot (Scale), Set the Head View With the Mask (handles), Change the Length of a Help Reply (prompt Options). Also "How to Edit the Preset That Help Uses" for the Endpoint editor. "How to Use a Different AI for Help" now says Add copies the preset and moves Answer. Reference sections updated: General (Scrim Opacity row), Endpoint (one row, no preset list, heading follows Answer, Delete moves Answer to Use Active Endpoint), Mascot (side rule, two columns, selection preview, Scale row, handles, Play both ways), Ask (scroll arrow), Tools (`read_guide` starts on). Lookup Mode starting on was already in "How to Let Your AI Read More of the Guide".

First draft of the Options how-to was titled "How Long or How Free a Help Reply Is". Its "Max Output" keyword pushed it into the top 5 for "What does Settings → Output hold?" and `bundledDocsIndex.test.ts` failed. Renamed to "Change the Length of a Help Reply" with no "output" in its keywords. Docs tests green.

**Recall probe** (cloud, `shipped` arm, 5 runs, 191 questions, 517 headings, 0 failed requests):

| Set | Recall@5 after help-take-me-there 06 (507 headings) | Recall@5 now (517 headings) |
|---|---|---|
| known | 84.5% (83.5–85.6) | 83.9% (82.5–85.6) |
| blind | 87.2% (85.1–88.3) | 87.9% (86.2–89.4) |

Both sets sit inside the earlier intervals. No control run on the old docs; the cloud drifts between batches. The report is in the worktree's `testing/baseline/runs/` (ignored), so this table is the record.

**Playwright** (`e2e/formaquestion-mascot.spec.ts`, desktop, new block "the second pass controls"):

- A percent Scale sizes the window's Mascot at 592px (50% of the 1184px base), level with the column bottom, and Auto returns it to the column height.
- The Scrim paints 12px past the column on every side at opacity 0.6, with the field above it and a press on its rim reaching the app.
- On a 1280×700 screen the Mascot tab's preview keeps its place while the controls column scrolls.
- The Endpoint tab puts the Answer and Pick fields on one row, under a heading `Edit … (Active Endpoint)`.

Mutation checks, all four cases fail together with the old behavior back: Scale forced to Auto; Scrim inset `-inset-1`; Endpoint grid without `sm:grid-cols-2`; Mascot tab without the `lg` grid. All restored.

The spec's earlier Playwright items (handle fade and coarse pointer, flip across the middle, minimal grip, per-style size after reload, arrow above the input) were already covered by tickets 02, 03, 05 and 07.

**Stale tests fixed** (`e2e/formaquestion.spec.ts`, mobile). "Settings in the menu hides the sheet…" and the AI Context twin asserted the sheet was hidden. Ticket 06 (Q42) replaced the hide with a slide-over: the sheet waits drawn and inert under the dialog. Both now assert the sheet has an inert ancestor while the dialog is open and none after it closes.

Full run of both Formaquestion specs, both projects: 53 passed, 55 skipped (project gates), 2 failed before the fix above, and both pass after it.

**Changelog.** Folded into the Formaquestion entry (its last sentence now names the how-tos), not a new entry. The recall probe ran before the Endpoint how-to, so the index holds one heading more than the 517 the probe saw.

**Review folded in** (`/mattpocock-skills:code-review`): Endpoint editor how-to added; the Options how-to now says each option has its own checkbox (Max Output included); the Mask fade line names the focus and drag cases; the Scrim and Endpoint e2e titles now say what they assert (the 60% default; the active-endpoint heading); the `setScale` comment states the Auto stop at 20. Named, not fixed: the Endpoint e2e finds its two selects by position because `EndpointRouteField` gives them no accessible name (a `src` change outside this ticket); and the long Formaquestion changelog entry still says the Endpoint editor's "preset list and **Add New Preset** choose the preset to edit", which pass two replaced (ticket 08 added its own line instead).

Gates (base `ccd919e0`): typecheck exit 0 (5.5s); changed lint exit 0; affected tests 48 files, 727 tests, exit 0 (40s); build exit 0 (20s).
