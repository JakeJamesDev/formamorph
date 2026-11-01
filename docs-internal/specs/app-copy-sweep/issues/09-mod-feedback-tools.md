# 09: Mod and Feedback Tools

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: staff-only screens; the same rules with less ambiguity.

## What to build

Sweep the copy of the admin panel and the feedback hub under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- In `src/components/menu/`: `AdminPanelDialog`, `AuditLogTab`, `AutoApprovedTab`, `BroadcastsTab`, `EventFormDialog`, `EventsTab`, every `Feedback*` file, `ManageUsersTab`, `MessageComposerDialog`, `MessagesTab`, `ModerationTab`, `NotificationsTab`, `PoliciesTab`, `ReportsTab`, `ReviewItemDialog`, `ReviewTab`, `SentMessageList`, `ServerSettingsTab`, `SuspendDialog`, `TermsTab`
- `src/lib/feedbackPresentation.ts`, `src/lib/listingModeration.ts`

**Notes**

- Anti-abuse copy names the pattern, never an account.

Spec: Rulings, "Per ticket", "Facts and bugs", Testing Decisions.

## Acceptance criteria

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Every string in the 50 files read; facts checked against the code (profile tabs, scope options, lock rules, gate kinds).
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. See Landed.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. raw-hint-role 56 → 1, triaged below.
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. Renames below; fixed-string grep of src, site, e2e and docs for every old string.
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). Four: "rides along" ×2 and "fights it" in `EventFormDialog.tsx`, "lands" in `EventsTab.tsx` and `ManageUsersTab.tsx`, the false "two popups" plus history in `PoliciesTab.tsx`, and the false "shown during publishing" in `PolicyDialog.tsx` (routed here by the spec session).
- [x] Every test that pinned a changed string is updated. Fixed-string grep of every removed literal over src, site and e2e tests; review gates and affected suites green.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. One fix, `AuditLogTab.test.tsx` "names an avatar listing by the word the app shows for it", red with the `model` entry removed.
- [x] No changelog fragment.

For you: Open the admin panel tabs and the feedback hub as a moderator, and read the help text.

## Landed

**copy:sweep, ticket files plus the routed files (51):** 129 notices before, 52 after. The 18 routed files had none before.

| Rule | Before | After |
|---|---|---|
| raw-hint-role | 56 | 1 |
| period-shape | 22 | 19 |
| label-case | 21 | 21 |
| uncontracted | 9 | 1 |
| label-parenthetical | 7 | 7 |
| em-dash | 6 | 0 |
| ellipsis | 2 | 0 |
| app-subject | 1 | 0 |
| raw-font-size | 1 | 1 |
| term-picture | 1 | 0 |
| on-off-preamble | 1 | 0 |
| term-character | 1 | 0 |
| figurative | 1 | 1 |
| many-sentences | 0 | 1 |

**Triage of what remains**

- label-case: accessible names and status lines in sentence case ("Sort by", "Delete thread", "Nothing waits for review"). Case-only (Q5 nit).
- period-shape: status lines and empty states with a subject keep their period ("No replies yet.", "These threads didn’t load."); confirmations and dialog descriptions are full sentences. Six are split by `<strong>` in JSX and end with a period in fact (Broadcasts, the event form, the draft note, Following, the Upload Gate reset, All Messages).
- label-parenthetical: `${usernameOf(user)}` in accessible names. False positive.
- many-sentences: the avatar removal confirmation, read across a template expression. Three sentences, a confirmation.
- raw-hint-role: the Filters popover's field label. A section label, not help.
- raw-font-size: the 9px initial inside a 16px mention avatar in `FeedbackMarkdown.tsx`. No text role fits that size.
- uncontracted, figurative: `rejectedUpdateTemplate`, a staff draft (R31). "Live version" is also the **Live** badge's term.

**Renames (R14: every quote updated)**

- "Edit This Report" → "Edit This Thread", tooltip "Edit this report" → "Edit this thread": the dialog edits suggestions and questions too. Thread view, thread writes and the website e2e spec.
- Log filter options "Terms reset (everyone)" and "Privacy policy reset (everyone)" → "… for everyone".
- Inbox pin marker "Pinned by an administrator" → "Pinned by an admin", the role's label. `MessagesTab.test.tsx`.
- Placeholders: "Search users..." → "Search users", "Add tags..." → "Add a tag", "Add to the thread" → "Write a reply", "A line for the reporters (optional)" → "Add a line for the reporters" with an "Optional" in its Hint (R25).
- Confirm buttons name their action instead of "Confirm": Delete (comment, thread), Recall, Remove (profile image), Reset Terms, Reset Everyone, Write Message (both notices). Same as ticket 08; no button changes color.

**Drive-by corrections**

- The feedback dialog said replies show "under Bugs in your profile". The profile has no feedback tab; they show under the Bugs, Suggestions and Questions tabs in **Feedback**. Its "we" became "staff".
- The thread's lock failure said "Failed to lock the thread" on an unlock too. Test: `FeedbackThreadView.test.tsx` "names the unlock when an unlock fails".
- The composer's Severity and Send As selects had no accessible name; they take their visible labels. Test: `MessageComposerDialog.test.tsx` "take their visible labels as their names".
- The Terms tab said accepting is needed to publish "worlds, characters or dictionaries". It covers every publish; it says Community Creations.
- The Broadcasts hint said only pinned messages reach later accounts; **Existing + New** does too.
- The publish toast lost its exclamation ("World published successfully!" → "World published"). `PublishModal.review.test.tsx`, `listingModeration.test.ts`, `e2e/contest-entry.spec.ts`.
- `contentReports.ts` (R33, the Report dialog's validation): "Pick what is wrong with it." → "Choose what’s wrong with it."
- Event summaries drop the em-dash: "Canceled · Entries released, broadcast recalled" (an announcement has no entries: "Canceled · Broadcast recalled"), "1st Place: X by author".
- The Reports tab told a mod that "an admin closes" staff content; an admin can't resolve reports on another admin's content either. It says "This content is by a staff member you can’t moderate."
- Stale "profile tab" comments in the feedback files name the Feedback window; `FeedbackHubDialog.tsx` lost its history.

**In-place bug fixes**

- `auditPresentation.ts`: a Log line about an avatar, mascot or prompt listing named it by its server kind ("deleted the model …"). It names the kind the app shows. Test: "names an avatar listing by the word the app shows for it".

**Findings**

- `src/lib/feedbackCapabilities.ts`: `profileThreads` and its comment still say threads are followed "under a profile tab". The copy now names Feedback; the flag name is stale. Not a ticket file.
- Hints after their control (R15): the Banner Text, Rules, Poster and Starts hints in the event form, and the composer's scope hint.
- `FieldError` carries send and save failures no field owns (feedback send, edit save, thread writes), as ticket 08 did. Its doc says "tied to the field above it"; a form-level error role may be worth a Design System ruling.
- `ReviewItemDialog.tsx` "Another staff member decides on this one": shows when the staff ladder bars this viewer. It does not say who can decide; left as is.

**Not verified**

- No rendered read of the admin panel or the feedback hub. The tests read the DOM; nobody looked at the screens.

**For you**

- Open the admin panel tabs and the feedback hub as a moderator, and read the help text.
- Confirm buttons in the panel now read Delete, Recall, Remove, Reset Terms, Reset Everyone or Write Message instead of Confirm.
