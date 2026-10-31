# 09: Mod and Feedback Tools

Status: ready-for-agent
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

- [ ] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words.
- [ ] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason.
- [ ] Raw help paragraphs in the listed files render through Hint or Meta.
- [ ] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests.
- [ ] Comments in the listed files changed only when false, history-telling, or figurative (Q6).
- [ ] Every test that pinned a changed string is updated.
- [ ] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed.
- [ ] No changelog fragment.

For you: Open the admin panel tabs and the feedback hub as a moderator, and read the help text.
