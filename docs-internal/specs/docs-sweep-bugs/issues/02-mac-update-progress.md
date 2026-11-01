# 02: Mac Update Leaves the Progress Bar

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: an IPC contract change across the Electron main process, the preload bridge and the update reducer, proved without a Mac.

## What to build

On a Mac, **Download** opens the new `.dmg` in the browser. The main process sends no progress, so the footer sits at a 0% bar reading 0 B until the next check, about three hours later. Have the desktop download call tell the renderer that the download went to the browser. The renderer then returns the footer to the update-available state, and the update dialog says the file opened in the browser (Q7). The renderer never guesses the platform.

Spec: Q7, Implementation Decisions "Update state". Evidence: docs-sweep ticket 01, Landed.

## Acceptance criteria

- [ ] A hook test with a fake desktop bridge whose download resolves as opened-in-browser and sends no progress fails today (the phase stays downloading), then passes with the phase back at available
- [ ] The download path that sends progress (Windows and Linux) still reaches downloading and downloaded (existing tests green)
- [ ] The update dialog shows the opened-in-browser line after a browser download, and only then (component test)
- [ ] The Saves-and-Backup page's Mac note says what the footer and the dialog show after the `.dmg` opens; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤

For you: on a Mac, **Download** opens the `.dmg` and the footer goes back to **Download** (the ticket proves it through a fake bridge only).
