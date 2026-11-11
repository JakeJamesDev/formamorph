# 25: Red Tests At The Close

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The full test run at the close of this spec was red: 34733 passed, 5 failed, in two files. Neither file is in this effort's landings. The run was on main at `89aff2643`, on 2026-11-10, with no other gate run holding the lock.

Find out why each fails, and fix the cause. Do not weaken a test to get green.

**1. `electron/llamaServer.test.mjs` > instancePid > lists this OS's real process table, this process under its parent**

```
Error: powershell.exe did not answer within 15000 ms
```

The test asks the real process table through PowerShell. It ran inside a 12-minute full suite. First question: does it pass alone, and does it pass in a second full run? A slow answer under load points at the timeout or at the test using the live machine; a failure alone points at the code.

**2. `src/views/MainMenu.cudaNotice.test.tsx`, four tests of "the CUDA notice on the main menu"**

- shows once the engine first starts on a supported card with no CUDA install
- holds back while the load is still deciding whether the AI is usable, then shows
- starts the install on Download, closes, and stays closed on the next start
- closes on Not Now without installing, and stays closed on the next start

```
TestingLibraryElementError: Unable to find role="region" and name "CUDA Engine"
```

All four fail at the same lookup: the notice never renders. The last commits on that test file are "Lead with Formamorph AI on Every Low-VRAM Desktop" and "Hold The CUDA Notice While A Dialog Is Open". A worktree named `fix-cuda-notice-popover-hold` exists, so another session may already own this. Check with it before you edit.

Not diagnosed: nobody ran either file alone after the close.

## Acceptance criteria

- [ ] Each failure has a stated cause, with the evidence: the test run alone, and the commit or condition that makes it fail.
- [ ] `electron/llamaServer.test.mjs` passes alone and inside a full run, or the landing report says why a full run can still starve it and what was changed.
- [ ] The four CUDA notice tests pass, and the fix is in the code or in a test that had gone stale, with the reason stated for which one.
- [ ] If another session already fixed the CUDA notice, this ticket names its commit and closes that half.
