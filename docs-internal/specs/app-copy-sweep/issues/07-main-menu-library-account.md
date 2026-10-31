# 07: Main Menu, Library and Account

Status: ready-for-human
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

- [x] Every help line, ⓘ body, tooltip, description, status, error and confirmation in the listed files follows the Writing Guide, written from a facts list in the user's words. Hand pass over every string in the listed files and the four R28 lib files; Standards and Spec reviews folded in.
- [x] The copy:sweep count per rule before and after is recorded here; each remaining notice has its triage reason. Table below.
- [x] Raw help paragraphs in the listed files render through Hint or Meta. raw-hint-role 54 → 0, plus two help `div`s the script does not read (`EnterWorldLibrary`, `SupporterOnlyCard`).
- [x] Labels changed only for a wrong term, a parenthetical aside, or a name that differs from its help (Q5). Each rename is checked against the Find bar and the tests. Renames listed below. None names a world field, so the Find bar is not affected; every test, wiki page and design-system quote is updated (R14).
- [x] Comments in the listed files changed only when false, history-telling, or figurative (Q6). Image verbs ("lands", "stands", "rides", "hangs off"), two history notes in `MainMenu.tsx`, one false example in `componentUpdates.ts`, and the figurative doc comments in `DeleteAccountDialog` and `AccountDeletionContext`.
- [x] Every test that pinned a changed string is updated. Grep for each old string across `src/`, `site/` and `e2e/`; gates green.
- [x] Each in-place bug fix has a test that fails with the bug reinstated, and is listed as a drive-by under Landed. No bug fixes in place.
- [x] No changelog fragment. None in the diff.

## Landed

**Not verified**

- None. The screens were not opened in the preview. That check is the For-you line below.
- `e2e/app.ts` and `e2e/privacy-policy.spec.ts` follow the new sign-in description, but the Playwright suite is outside the gates and did not run.

**For you**

- For you: Open the main menu, the library, **Backup & Restore** and the account tab, and read the help text.
- Role swaps change type size: some status lines moved from `text-helper` to `Meta` (smaller), and the Linked Content, Listing and Changelog Entry help lines moved from `text-meta` to `Hint` (larger). Check the Publish dialog and Backup & Restore read well.
- The sign-up **Email** field now has one Hint above the box: "Optional. Lets you reset your password once you confirm it by email."

**Renames** (veto any of these)

- "Delete Character" → "Delete Entity", with the reference screen `MainMenuContextMenuReference` (ticket 11's) and its test and the Design System doc (R14).
- "Delete Player Avatar" → "Delete Avatar"; "No player avatars yet" → "No avatars yet". The body states the consequence (R9): "This Avatar is deleted from your library."
- "Position Your Picture" → "Position Your Profile Image" (wiki `Account.md`, help baseline case).
- "Email (Optional)" → "Email" with an "Optional" Hint (R25).
- "Deletion Cancelled" → "Deletion Canceled" (American spelling), with `surfaceLabels.ts` and `Account.md`.
- Update review field labels match the editor: "Also Known As" → "Aliases", "Player/AI Description" → "Player-Facing/AI-Facing Description", "AI Summary" → "AI-Facing Summary", "Cover Art" → "Cover Image".
- Version line tag "— Update Available!" → "· Update Available"; update dialog title "Update available — v" → "Update Available: v" (wiki `Saves-and-Backup.md`, `Install-on-Android.md`).
- New entity draft name "New Character" → "New Entity"; character-card import toasts count entities.

**Drive-bys:** none beyond the renames. No in-place bug fixes. `site/bundleBoundary.test.ts`: the `ui/typography` entry (73, added by a peer ticket) now also names `PatreonSection` and `DeleteAccountDialog`, which the site shares.

**Sweep counts** (`copy:sweep` over the ticket's files plus the R28 lib files, 45 files)

| Rule | Before | After | Triage of what remains |
|---|---|---|---|
| raw-hint-role | 54 | 0 | — |
| period-shape | 24 | 20 | 14 are status, error or confirmation sentences with a subject, which keep their period. 6 are false positives: the script splits a sentence at an inline `<span>` or `<strong>` (the four library empty states, the restore Hint, "Backup restored. Reloading…") |
| label-case | 9 | 9 | Case-only (Q5 nit) or a sentence-shaped accessible name ("They did", "Loading linked accounts") |
| raw-font-size | 7 | 7 | Badge and footer sizes below the smallest text role (`text-[10px]`, `text-[11px]`). Changing them is a layout change |
| label-parenthetical | 5 | 5 | False positives: `sourceLabel(item.source)` is a function call in a template, not an aside |
| ellipsis | 3 | 4 | Progress states ("Checking…", "Loading…", "Reloading…") |
| term-character | 4 | 1 | `HostedAiPanel`: "Characters per token" means text characters |
| uncontracted | 6 | 0 | — |
| em-dash | 5 | 0 | — |
| app-subject | 3 | 0 | — |
| term-picture | 1 | 0 | — |
| **Total** | **121** | **46** | |

`src/lib/backup.ts` and `src/lib/worldPrompt.ts` (R28) were read and hold no string that needed a change.

**Findings** (not edited here)

- R29: the world trust notice and its **Examine Code** view (`MainMenu.tsx` `hasStatWithCode`, `generateConcatenatedCode`) cover world and stat scripts only. Trait, item and Tool scripts are not detected or shown. The code view now says "Scripts on this world and its stats", which is true of what it shows.
- R15: help placed after its control, kept as layout: Account email ("You'll get a link…"), Delete Account password step, Sign In username rule, rename dialog username rule, Listing and Linked Content visibility lines.
- The site's own pages (`site/pages/RegisterPage.tsx`, `LoginPage.tsx`, `AccountPage.tsx`) keep their own copies of the old sign-in, register and account strings ("Email (Optional)", "Passwords do not match", "Both current and new passwords are required"). `site/` is out of scope, so the app and the site now word these differently.
- `usernameRule.ts` "Usernames follow a new rule" describes a change. It is the rename prompt's status line, shared with the site's rename page; a present-tense wording needs the rest of that sentence reworked on both surfaces.
- `surfaceLabels.ts` key `deletionCancelled` keeps the British spelling. It is a shared surface id, so it stays.

**Shared strings sent to the spec session:** none.
