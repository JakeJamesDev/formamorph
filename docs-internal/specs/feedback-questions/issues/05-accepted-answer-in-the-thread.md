# 05: Accepted Answer in the Thread

Status: ready-for-agent
Blocked by: 02, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high
Repo: formamorph
Spec: the client spec (Accepted answer in the thread view, Status control, Audit)

Model rationale: one view, but the thread view updates parts of itself locally in five places, and each must keep the pinned copy current.

## What to build

On a question, the asker and staff see **Accept Answer** on each reply and **Clear Answer** on the accepted one. The accepted answer shows as a pinned copy under the question body, and the reply keeps its place with an **Accepted** mark. The pin follows edits, deletes and type changes. The staff status control reads correctly on an answered question.

## Acceptance criteria

- [ ] The thread view draws the pinned copy and the mark from `acceptedAnswer` with the existing comment renderer.
- [ ] Accept and clear show for the asker and staff on questions only, and call the answer route.
- [ ] Deleting or editing the accepted reply, and a type change, refetch the thread; the pin updates.
- [ ] The staff status Select on a question offers Open and Closed, with Answered shown disabled.
- [ ] The edit dialog's warning, moving out of a question with an accepted answer, adds "clears the accepted answer" to its first sentence.
- [ ] `feedback_answer_set` joins the client's audit actions with a label and a style.
- [ ] A dev route opens a thread with an accepted answer through ticket 04's stub.
- [ ] Each guard is proven by removing it once and watching its test fail: accept on a bug, accept for a stranger.
- [ ] Frames: `.scratch/frames/accepted-answer-light.png` and `.scratch/frames/accepted-answer-dark.png`, the answered thread at desktop width; `.scratch/frames/accepted-answer-mobile.png` at mobile width.
- [ ] The help doc's Feedback section describes accepted answers. No changelog fragment: the spec session folds this into ticket 04's entry at close.

For you: whether the pinned copy and the mark read as one answer, not two.
