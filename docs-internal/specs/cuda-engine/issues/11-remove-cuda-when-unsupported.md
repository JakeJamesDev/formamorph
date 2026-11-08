# 11: Remove CUDA When Unsupported

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: a status-order change in the install module plus one row state.

## What to build

A player whose machine stops being supported after CUDA was installed, for example after a driver rollback, can still free the space. Today the install status reports `unsupported` before it checks for installed or stale folders, so the CUDA row shows the reason and no Remove. The CUDA files (about 800 MB) stay on disk. User story 22 says: "I want a Remove button, so that I can free the disk space." Found in the close review.

The row keeps the unsupported reason and no Download, and adds Remove whenever a CUDA folder exists. Remove follows Q16: it stops a running engine after a confirm.

## Acceptance criteria

- [x] On an unsupported machine with an installed or stale CUDA folder, the row shows the reason and Remove. (install module test and Local Model panel test) Installed already kept Remove; the stale case now reads `hasFiles` (cudaInstall.test.mjs, LocalModelPanel.test.tsx).
- [x] Remove deletes the folder, and the row then shows the reason alone. (install test: folder gone, no `hasFiles`; panel test: Remove gone after the pushed status)
- [x] On an unsupported machine with no CUDA folder, nothing changes. (install test: no `hasFiles`)

## Landed

**Not verified**
- Partials in the staging folder alone do not show Remove on an unsupported machine; the ticket names installed or stale folders only.

**For you**
- Roll the driver below the floor with an older-tag CUDA folder on disk. Look in Local Model, CUDA row: reason plus Remove, then reason alone after Remove.
