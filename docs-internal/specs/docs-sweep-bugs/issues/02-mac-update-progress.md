# 02: Mac Update Leaves the Progress Bar

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: an IPC contract change across the Electron main process, the preload bridge and the update reducer, proved without a Mac.

## What to build

On a Mac, **Download** opens the new `.dmg` in the browser. The main process sends no progress, so the footer sits at a 0% bar reading 0 B until the next check, about three hours later. Have the desktop download call tell the renderer that the download went to the browser. The renderer then returns the footer to the update-available state, and the update dialog says the file opened in the browser (Q7). The renderer never guesses the platform.

Spec: Q7, Implementation Decisions "Update state". Evidence: docs-sweep ticket 01, Landed.

## Acceptance criteria

- [x] A hook test with a fake desktop bridge whose download resolves as opened-in-browser and sends no progress fails today (the phase stays downloading), then passes with the phase back at available — `useUpdateChecker.test.ts` "returns to available when the download opened in the browser", red before the fix, green after
- [x] The download path that sends progress (Windows and Linux) still reaches downloading and downloaded (existing tests green) — new desktop-bridge streaming test plus the Android progress tests
- [x] The update dialog shows the opened-in-browser line after a browser download, and only then (component test) — `UpdateDialog.test.tsx` positive case and the four-phase negative case
- [x] The Saves-and-Backup page's Mac note says what the footer and the dialog show after the `.dmg` opens; the docs tests are green — `src/lib/docs` tests, 13 files green
- [x] A changelog fragment under Minor / Fixed / 👤 — `docs-internal/changelog.d/docs-sweep-bugs-02.md`

## Landed

**Not verified**

- The real Mac IPC round trip: no Mac here. The chain (`macDownload` return → `ipcRenderer.invoke` → hook) was read, not run.
- The dialog line in the live preview: the state needs a desktop bridge; the component test is the DOM read.

**For you**

- On a Mac, **Download** opens the `.dmg` and the footer goes back to **Download** (the ticket proves it through a fake bridge only).
- On a Mac, the update dialog shows "The download opened in your browser…" under **Release channel** after **Download**.
- The 0% bar still shows for the seconds the app takes to find the `.dmg` before the browser opens.
