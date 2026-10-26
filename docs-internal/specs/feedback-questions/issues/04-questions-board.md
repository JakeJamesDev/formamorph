# 04: Questions Board

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: the client spec (Copy, Type lists, Votable-board predicate, Defaults per type, Tabs, Dev routes)

Model rationale: wide but mostly mechanical. The spec lists the places the compiler will not catch.

## What to build

The Feedback dialog offers a third type, **Question**. The staff Feedback tab and My Feedback each get a **Questions** tab that mirrors the suggestion board: search, status and category filters, sort, scope, votes, and the same thread and reply surface. Questions open on Everyone's, Unanswered, Most Voted. Staff can convert between all three types in the edit dialog.

This ticket owns the client's votable-board predicate and the dev-route `FeedbackService` stub that tickets 05 and 06 reuse.

## Acceptance criteria

- [x] `question` joins the feedback types with its categories and statuses. Every per-type record has its question entry, with the strings from the spec's copy table. (`feedbackPresentation.test.ts`, dialog and tab copy tests)
- [x] Answered takes the success badge style and Closed the muted style. (`feedbackPresentation.test.ts`; frame `questions-tab-all-statuses-dark.png`)
- [x] The hand-pass places from the spec are done: type pickers and tab grids, tab id lists, the edit dialog's Kind list, the file button icon, the audit kind noun, the dev-route tab lists, the surface label, and the help doc surface map. (`FeedbackTab.test`, `FeedbackHubDialog.test`, `AuditLogTab.test`, `devRouter.test`; the surface map derives from the tab list)
- [x] One votable-board predicate decides reply rights, votes, the votes sort and the vote UI, for suggestions and questions. (`isVotableBoard`; mutation to suggestion-only turned 6 tests red)
- [x] The user filter defaults are per type; questions open on Everyone's, Unanswered, Most Voted. (`feedbackSorts.test`, request asserted)
- [x] Filing a question sends the question type and category; the thread shows the asker's vote. (`FeedbackDialog.test` "a question", `FeedbackThreadView.test` "a question thread")
- [x] The edit dialog offers three types, and its warning matches the target type. (`FeedbackEditDialog.test`, per the spec session's warning ruling)
- [x] Dev routes open the Questions tab in the hub and the admin panel, and the feedback form on a question, with a stubbed `FeedbackService` behind the dev flag. (DOM reads of all three routes with `fixture=feedback`; `devFeedbackStub.test.ts`)
- [x] Frames: `.scratch/frames/questions-tab-light.png` and `.scratch/frames/questions-tab-dark.png`, the hub Questions tab at desktop width. (1440×900)
- [x] The help doc's Feedback section describes questions. (`docs/Community-Creations.md`)
- [x] A changelog fragment adds one 👤 entry for the Questions board. Tickets 05 and 07 fold into it. (Topic **Feedback Questions**)

For you: the Questions tab copy and badge colors in the hub and the staff panel.

## Landed

**Not verified**

- None.

**For you**

- For you: the Questions tab copy and badge colors in the hub and the staff panel. Frames: `.scratch/feedback-questions-04/frames/questions-tab-light.png`, `.scratch/feedback-questions-04/frames/questions-tab-dark.png`, `.scratch/feedback-questions-04/frames/questions-tab-all-statuses-dark.png`.
- Dev routes: `#dev?modal=feedbackHub&tab=questions&fixture=feedback`, `#dev?modal=adminPanel&tab=feedback&subtab=questions&fixture=feedback`, `#dev?modal=feedbackForm&tab=question&fixture=feedback`.
- Until 05 lands, the staff status control reads blank on an answered question (ruling: 05 adds Answered back as a disabled item).
