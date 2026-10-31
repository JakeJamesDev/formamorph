# 07: Main Menu, Library and Account

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: the first screens a player reads, and `MainMenu.tsx` is a shared file.

## What to build

Sweep the copy of the main menu, library, account and publishing screens under the Writing Guide. Every copy role is in scope (Q1). Rewrite the copy yourself; never delegate it to a subagent.

**Files.** A file in these folders that is not listed belongs here too. A file that could belong to two tickets goes to the spec session.

- In `src/views/`: `MainMenu.tsx`, `EnterWorldFlow.tsx`, `EnterWorldLibrary.tsx`, `EnterWorldWorkspace.tsx`
- `src/components/library/`, `src/components/PatreonSection.tsx`
- In `src/components/menu/`: `AccountSettingsTab`, `AuthModals`, `SignInDialog`, `DeleteAccountDialog`, `LinkedAccountsPanel`, `HostedAiPanel`, `PublishModal`, `LinkedContentSection`, `CompatibleWorldsSection`, `BackupRestoreDialog`, `AvatarCropDialog`, `ProfileAvatarEditor`, `UpdateVersionControl`, `SupporterOnlyCard`
- In `src/components/modals/`: `UpdateAvailableDialog`, `UpdateDialog`, `UpdateRequiredDialog`, `UsernameRenameDialog`
- `src/contexts/AccountDeletionContext.tsx`, `src/lib/hostedAi/`, `src/lib/componentUpdates.ts`, `src/lib/useComponentUpdates.tsx`

**Notes**

- This ticket owns `MainMenu.tsx` in this effort. It is a shared file on the main checkout; the ticket worktree and prepare's rebase handle it.

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

For you: Open the main menu, the library, **Backup & Restore** and the account tab, and read the help text.
