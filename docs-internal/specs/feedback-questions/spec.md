# Spec: Feedback Questions (client)

Status: done
Status note: Closed 2026-10-26. Tickets 01–07 landed; last landing a30e022f5 (server: 33288f0, a4c5e42, f1df356). Review: spec text corrected. Gates green on 2026-10-26.
Spec session: feedback-questions — spec

Server side: the FormamorphServer repo, `docs-internal/specs/feedback-questions/spec.md`. That spec holds the rulings (Q1–Q24) and the API contract. This spec follows them.

## Problem Statement

Players who are stuck have no place to ask. The Feedback dialog offers a bug report, which only the reporter and staff can reply to, or a suggestion, which is a request for a change. Neither fits a question. When the Formaquestion help window cannot answer, the player reaches a dead end. When many players share a question, nothing shows how many, and an answer given once is hard for the next player to find.

## Solution

- The Feedback dialog gets a third type, **Question**, with its own tab, categories, statuses and filters. It mirrors the suggestion board: anyone signed in can reply and vote, with the same search, filter and sort row and the same authoring and comment surface.
- The asker or staff can mark one reply as the answer. A pinned copy of the accepted answer shows under the question. The reply keeps its place in the thread with an **Accepted** mark.
- While a player types a new question's title, the dialog lists matching questions. A result opens the thread inside the dialog, where the player can read it and vote "me too". **Back** returns to the draft.
- Every Formaquestion answer gets an **Ask the Community** button. It opens the Feedback dialog on a new question with the title filled in from the player's question.
- The staff Feedback tab and My Feedback each get a **Questions** tab.

## Copy

Settled by a copy sweep (Q18). Strings follow the shape and voice of the existing bug and suggestion strings.

| Slot | Text |
| --- | --- |
| Type tab / one / many | Question · Question · Questions |
| Categories | Gameplay · World Editor · AI setup & models · Community & publishing · Account · Something else |
| Statuses | Open · Answered · Closed |
| Unresolved filter label | Unanswered |
| Filtered-empty line | No questions match this filter. |
| Scope labels | Mine · Everyone’s |
| Search label | Search Questions |
| Dialog description | Everyone can read, answer and vote on questions. Similar questions show as you type a title. You can follow replies under Questions in your profile. |
| Title placeholder | What you want to know, in a line |
| Body label / placeholder | What You Tried · Where you got stuck, and what you tried already |
| Submit / sent | Post Question · Question posted — you can follow it under Questions in your profile |
| Empty: mine / all / search | You haven’t asked anything yet. · Nothing has been asked yet. · No questions match this search. |
| File button | Ask a Question |
| Duplicate list heading | Similar Questions |
| Accept action / clear action | Accept Answer · Clear Answer |
| Mark on the reply | Accepted |
| Pinned copy heading | Accepted Answer |
| Help window button | Ask the Community |
| Replace-draft confirm | Replace Unsent Draft? · This deletes your unsent draft. · Replace · Keep Draft |
| Edit warning, every target | Today's sentence: "Moving this to a X sets its status back to Open[, and deletes the version and platform…]. Its replies and votes stay." |
| Edit warning, into a bug | Today's sentence, then: Only the reporter and staff can reply to a bug. |
| Edit warning, out of an answered question | The first sentence adds "clears the accepted answer" (ticket 05). |

`gameplay`, `editor`, `community` and `other` reuse the existing labels. `setup` and `account` are new. **Answered** takes the success badge style and **Closed** the muted style, as Resolved and Won’t Fix do. "Accepted" also labels a policy in Manage Users; the two surfaces never show together.

## User Stories

1. As a player, I want a Question choice in the Feedback dialog, so that I can ask without filing a bug.
2. As a player, I want a Questions tab, so that I can browse what others asked.
3. As a player, I want the Questions tab to open on unanswered questions from everyone, sorted by votes, so that I see what most people still need.
4. As a player, I want to search questions by any words, so that I find one without its exact wording.
5. As a player, I want to filter questions by status and category, so that I can narrow the list.
6. As a player, I want to sort questions by votes, newest, oldest and activity, so that I can choose the order.
7. As a player, I want to switch between everyone's questions and my own, so that I can follow what I asked.
8. As a player, I want similar questions listed while I type a title, so that I can find an existing one.
9. As a player, I want to open a similar question inside the dialog, so that I can read its answer without losing my draft.
10. As a player, I want Back to return me to my draft, so that I can still post if the match was wrong.
11. As a player, I want to vote on a question from the list and the thread, so that I can say "me too".
12. As an asker, I want my question to start with my own vote, so that the count matches the suggestion board.
13. As an asker, I want an Accept Answer action on each reply, so that I can mark the one that solved it.
14. As an asker, I want to accept my own reply, so that a solution I found is recorded.
15. As an asker, I want a Clear Answer action, so that I can undo a wrong pick.
16. As staff, I want Accept Answer and Clear Answer on every question, so that I can resolve abandoned ones.
17. As a reader, I want the accepted answer pinned under the question, so that I find it without scrolling.
18. As a reader, I want the accepted reply marked in place, so that I can read it in context.
19. As a reader, I want the pinned copy to follow edits and deletes of the accepted reply, so that it never shows stale text.
20. As a voter, I want an unread mark when someone replies, so that I learn when it gets an answer.
21. As staff, I want a Questions tab in the Feedback tab, so that I can work through questions as I do bugs and suggestions.
22. As staff, I want to close a question, which also locks it, and reopen it, so that duplicates and stale questions stop collecting replies.
23. As staff, I want the status control to show Answered on an answered question, so that the control never reads blank.
24. As staff, I want Question in the edit dialog's Kind select, so that I can convert between all three types.
25. As staff, I want the conversion warning to say what resets, so that I know what I lose.
26. As a player in the help window, I want an Ask the Community button under each answer, so that I can ask people when the answer is not enough.
27. As a player, I want the new question's title filled in from what I asked the help window, so that I do not type it again.
28. As a player, I want the Feedback dialog to open above the help window, so that I can see and use it.
29. As a player with an unsent draft, I want to be asked before a pre-fill replaces it, so that I do not lose my writing.
30. As a signed-out player, I want Ask the Community to ask me to sign in, as Report Bug in Error Details does, so that I can still ask.
31. As a developer, I want dev routes for the Questions tab, the new-question dialog and an answered thread, so that the screens are testable.

## Implementation Decisions

- **Type lists.** `question` joins the feedback types, with its own category and status lists, mirroring the server. Every `Record<FeedbackType, …>` gains its question entry, and the compiler finds those. These places do not fail the compiler and need a hand pass:
  - The `grid-cols-2` type pickers and tab lists in the Feedback dialog, the staff Feedback tab and My Feedback.
  - The hand-written tab triggers and the tab id lists for both tab sets.
  - The literal two-type list in the edit dialog's Kind select.
  - The file button's icon choice in the filter row.
  - The audit presentation's kind nouns, typed as a plain string record.
  - The dev-route tab lists for the feedback hub and the admin feedback panel.
  - The surface label for the hub's Questions tab, the help doc's Feedback section, and its surface map entry.
- **Votable-board predicate.** Where the client branches on "is a suggestion" to decide reply rights, votes, the votes sort or the vote UI, it uses one shared predicate that is true for suggestions and questions. Branches that mean "is a bug" (diagnostics, staff rewrite of the text) stay.
- **Defaults per type.** Questions open on scope Everyone's, status Unanswered, sort Most Voted (Q12). The staff queue opens on Unanswered, Most Voted. Unanswered means `open` only. The user filter defaults today hard-code Newest for every type, so the default sort becomes per type.
- **Accepted answer in the thread view.** The view reads `acceptedAnswer` from every thread response and draws the pinned copy under the question body with the same comment renderer. The **Accepted** mark goes on the reply whose id matches. Accept and clear sit in the reply's action area, for the asker and staff, on questions only.
  - The view updates parts of the thread locally today: a comment delete filters, a comment edit replaces, a type change writes the thread, and status and vote replies replace it. After a delete or edit of the accepted reply, and after a type change, the view refetches the thread so the pinned copy cannot go stale.
- **Status control.** On a question the staff Select offers Open and Closed (ticket 04), with Answered shown disabled (ticket 05) so the control reads correctly on an answered question. Closing locks the thread on the server, so the view reads the lock from the response.
- **Duplicate check.** The new-question dialog calls the list with `type=question`, `scope=all`, no status filter, a short debounce, and a small limit, once the title has a few characters. The server's word search (Q19) ranks the results. Responses that resolve after unmount or after a newer keystroke are dropped. This runs only for questions.
  - Settled numbers: 3+ trimmed title characters, the existing search delay, limit 5, no sort sent. A row shows title, status badge and vote count. No results or a failed request hide the list.
- **Thread pane in the dialog (Q20).** Selecting a duplicate result swaps the dialog's form for the existing thread view and its own **Back** button. The draft stays in place. The pane resets to the form on each open. Voting and replying work in the pane as they do in the hub. This works wherever the dialog opens, including the help window in a game or the editor, where no feedback hub exists.
- **Feedback opener.** The bug-report store widens into a feedback opener whose state is `{ open, type, fill, opener }`. `opener` is the element that opened the dialog, kept for focus return. Its two users today, the error-details host and the bug report host, move to it. The host passes the type to the dialog. The Formaquestion button calls it with type `question` and the exchange's question as the title: whitespace collapsed to single spaces, then cut to the title limit.
- **Replace-draft confirm (Q21).** The dialog keeps one shared draft. When an opener call carries a fill and the draft has text, the dialog asks before replacing it. **Keep Draft** opens on the draft unchanged. An empty draft takes the fill at once, and a draft that already equals the fill skips the confirm. This applies to error reports too.
- **Layering above the help window.** The help window lives in the shielded window layer, above dialogs. The layer drops below dialogs through Formaquestion's `covered` flag, as the Open Wiki confirm does today. Formaquestion subscribes to the feedback opener and adds its open state to `covered`, and covers while sign-in is open too, so the sign-in dialog draws above it. On close, the dialog returns focus to the stored `opener`.
- **Sign-in and community gates.** The Feedback dialog has no sign-in gate of its own; its callers hide or gate the entry. The Ask the Community button follows Report Bug in Error Details: hidden when the community feature flag is off, and calling `requestSignIn` when signed out.
- **Button placement.** Answers render in three places: the ask panel, the minimal chat, and the bubble chat. The button goes in each, in the answer's footer row, which today renders only when sources are listed, so the row renders whenever the button shows. It shows once an answer has finished: status done, stopped, no AI or failed. It hides while the answer is writing.
- **Tabs.** The staff Feedback tab and My Feedback each add a Questions tab beside Bugs and Suggestions, with the same list component.
- **Audit.** `feedback_answer_set` joins the client's audit actions with a label and a style.
- **Dev routes.** The Questions tab joins the hub and admin-panel tab lists. The feedback form route takes a type parameter. The thread view fetches from the server, so the answered-thread route and the duplicate list need a stubbed `FeedbackService` fixture behind the dev flag.
- **Old servers.** The client ships after the server, so no compatibility code for a server without questions.
- **No export-shape change.** No world or save `.json` changes.

## Testing Decisions

- Test external behavior through the existing seams: spy on `FeedbackService` methods and render the dialog, list, filter row and thread view, as the current feedback suites do. Assert on what the player sees and which service call goes out. Do not assert on internal state.
- Presentation: each type has a label, categories, statuses, a default category, an unresolved set, default filters, scope and search labels, and the votes sort shows for questions.
- Thread view: the pinned answer and the mark render from `acceptedAnswer`. Accept and clear show for the asker and staff and are hidden for others and on bugs and suggestions. A click calls the answer route. Deleting or editing the accepted reply refetches and updates the pin. The status control shows Answered disabled.
- Dialog: the duplicate list appears for questions only, sends `scope=all`, ignores a stale response, and opens the thread pane; Back returns to the draft with its text. Filing a question sends the question type and category. A pre-fill over a non-empty draft asks first; an empty draft takes it at once.
- Edit dialog: the Kind select offers three types, and the warning matches the target type.
- Formaquestion: the button renders under a finished answer in all three chat styles and not while writing. It calls the opener with the question type and the collapsed title. Signed out, it calls `requestSignIn`. With the community flag off, it is hidden. Opening the dialog sets `covered`. Prior art is the Take Me There suite.
- Each guard gets a check that fails when the guard is removed: the accept action on a bug, the duplicate list on a suggestion, the button with the community flag off.
- Prior art: `FeedbackThreadView.test.tsx`, `FeedbackList.test.tsx`, `feedbackFilterRow.test.tsx`, `feedbackSearch.test.tsx`, `FeedbackDialog.test.tsx`, `ErrorDetailsReportBug.test.tsx`, `Formaquestion.takeMeThere.test.tsx`, `Formaquestion.openWiki.test.tsx`, `devRouter.test`.

## Out of Scope

- Email or push notifications. The unread badge stays the only signal.
- Polling the unread count. It still refreshes on sign-in and after the player's own feedback actions.
- Merging duplicate questions.
- Showing community answers inside the help window or feeding them into help retrieval.
- Votes on individual replies.

## Further Notes

- Land after the server spec is deployed.
- One 👤 changelog group, **Feedback Questions**, covers the effort: the board (04), Similar Questions (06), accepted answers (05) and the help window button (07). Tickets 05 and 07 wrote no fragment; the spec session added their entries at close.
