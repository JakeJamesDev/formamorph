# 01: Direct-Start Notice

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one main-process step on an existing, tested module, with an injected dialog.

## What to build

A Windows player who starts the inner `app\Formamorph.exe` sees a native message box before any window opens (Q4). It says to start Formamorph from the main `Formamorph.exe` and shows that file's full path. **OK** closes it. **Show in Folder** opens Explorer with the launcher selected. Either way, the app then restarts through the launcher as it does today. A launcher start shows nothing.

The launcher handoff module owns the step. The message box and spawn are injected, so the tests run without Electron. Write the copy from the Writing Guide.

## Acceptance criteria

- [ ] A direct start shows the message box once, with the launcher's full path in its text.
- [ ] **Show in Folder** reveals the launcher in Explorer, and the handoff still runs.
- [ ] **OK** runs the handoff.
- [ ] A launcher start, a non-Windows platform and an unpackaged run show no message box.
- [ ] When the launcher is missing, the app shows no message box and keeps running.
- [ ] Tests use a fake dialog and spawn. Removing the message box call makes a test fail.
- [ ] A changelog fragment covers the notice.

For you: start a packaged build from `app\Formamorph.exe` and read the message box.
