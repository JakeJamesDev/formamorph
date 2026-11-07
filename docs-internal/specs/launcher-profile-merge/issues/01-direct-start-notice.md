# 01: Direct-Start Notice

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one main-process step on an existing, tested module, with an injected dialog.

## What to build

A Windows player who starts the inner `app\Formamorph.exe` sees a native message box before any window opens (Q4). It says to start Formamorph from the main `Formamorph.exe` and shows that file's full path. **OK** closes it. **Show in Folder** opens Explorer with the launcher selected. Either way, the app then restarts through the launcher as it does today. A launcher start shows nothing.

The launcher handoff module owns the step. The message box and spawn are injected, so the tests run without Electron. Write the copy from the Writing Guide.

## Acceptance criteria

- [x] A direct start shows the message box once, with the launcher's full path in its text. (`direct-start notice` test)
- [x] **Show in Folder** reveals the launcher in Explorer, and the handoff still runs. (reveal test; a throwing reveal still spawns)
- [x] **OK** runs the handoff. (OK test)
- [x] A launcher start, a non-Windows platform and an unpackaged run show no message box. (`launcherToRestartThrough` returns null, so `main.cjs` never calls `handOff`)
- [x] When the launcher is missing, the app shows no message box and keeps running. (same null path)
- [x] Tests use a fake dialog and spawn. Removing the message box call makes a test fail. (mutation run: 3 tests failed)
- [x] A changelog fragment covers the notice.

For you: start a packaged build from `app\Formamorph.exe` and read the message box.

## Landed

**Not verified**
- None unticked. `main.cjs` wiring (dialog, `shell.showItemInFolder`, spawn passed to `handOff`) has no test; the packaged build is its only check.
- `showMessageBoxSync` and `showItemInFolder` before the app is ready are unverified. A throw is caught and the restart still runs.

**For you**
- Start a packaged build from `app\Formamorph.exe` and read the message box.
- Check that the box appears before any window, and that Show in Folder selects the launcher in Explorer.
