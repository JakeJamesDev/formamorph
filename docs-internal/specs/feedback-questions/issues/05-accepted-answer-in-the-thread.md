# 05: Accepted Answer in the Thread

Status: done
Blocked by: 02, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high
Repo: formamorph
Spec: the client spec (Accepted answer in the thread view, Status control, Audit)

Model rationale: one view, but the thread view updates parts of itself locally in five places, and each must keep the pinned copy current.

## What to build

On a question, the asker and staff see **Accept Answer** on each reply and **Clear Answer** on the accepted one. The accepted answer shows as a pinned copy under the question body, and the reply keeps its place with an **Accepted** mark. The pin follows edits, deletes and type changes. The staff status control reads correctly on an answered question.

## Acceptance criteria

- [x] The thread view draws the pinned copy and the mark from `acceptedAnswer` with the existing comment renderer. (test "pins a copy under the question and marks the reply in place")
- [x] Accept and clear show for the asker and staff on questions only, and call the answer route. (tests: asker accepts, staff clears, stranger, bug, suggestion)
- [x] Deleting or editing the accepted reply, and a type change, refetch the thread; the pin updates. (three refetch tests; the type-change stub returns a stale pin, so only the refetch clears it)
- [x] The staff status Select on a question offers Open and Closed, with Answered shown disabled. (test reads `aria-disabled` per option)
- [x] The edit dialog's warning, moving out of a question with an accepted answer, adds "clears the accepted answer" to its first sentence. (FeedbackEditDialog tests, with and without an answer)
- [x] `feedback_answer_set` joins the client's audit actions with a label and a style. (AuditLogTab test)
- [x] A dev route opens a thread with an accepted answer through ticket 04's stub. (`#dev?modal=feedbackThread&fixture=feedback`, `tab=staff` adds triage; DOM read and frames)
- [x] Each guard is proven by removing it once and watching its test fail: accept on a bug, accept for a stranger. (question check removed: bug and suggestion tests failed; identity check removed: stranger test failed; both restored)
- [x] Frames: `.scratch/frames/accepted-answer-light.png` and `.scratch/frames/accepted-answer-dark.png`, the answered thread at desktop width; `.scratch/frames/accepted-answer-mobile.png` at mobile width.
- [x] The help doc's Feedback section describes accepted answers. No changelog fragment: the spec session folds this into ticket 04's entry at close. (`docs/Community-Creations.md`, "Accepted Answers")

For you: whether the pinned copy and the mark read as one answer, not two.

## Landed

**Not verified**

- Delete, edit and type change run against the stub and jsdom only. No live server was available.
- A failed refetch after a delete or edit blanks the thread, as any failed load does today. Not changed.

**For you**

- Whether the pinned copy and the mark read as one answer, not two. Look at `.scratch/feedback-questions-05/frames/accepted-answer-light.png`.
- The mobile frame is the reader view, without triage controls: `.scratch/feedback-questions-05/frames/accepted-answer-mobile.png`.
