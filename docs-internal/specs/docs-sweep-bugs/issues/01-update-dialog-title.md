# 01: Update Dialog Title per Phase

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one pure function, one component, and the dialog copy under the Writing Guide.

## What to build

While a download runs or waits, the update dialog says **You're up to date**, hides the new-version notes marker and offers **Check for updates** in place of the download control. Give the dialog one pure function that maps each update phase to its title, and use it. The downloading and downloaded phases name the update. The notes marker stays during them. Checking and idle get a title that is true for them.

This ticket owns the phase → title function. Ticket 02 builds on it.

Spec: Q11, Implementation Decisions "Update state". Evidence: docs-sweep ticket 01, Landed.

## Acceptance criteria

- [x] A pure test of the phase → title function fails on today's mapping for the downloading and downloaded phases, then passes (`updateDialogTitle.test.ts`, run red before the fix)
- [x] The dialog shows the update's version and its notes marker while downloading and once downloaded (component test; the marker is read as the `updateVersion` prop on a stubbed notes body)
- [x] In downloading and downloaded the dialog hides Check for updates and Download and shows Close only (spec session ruling; `UpdateDialog.test.tsx`)
- [ ] Each title string follows the Writing Guide (copy-sweep on the changed strings)
- [x] The update dialog table on the Saves-and-Backup page lists every title; the docs tests are green (docs tests in the affected run)
- [x] A changelog fragment under Minor / Fixed / 👤

## Landed

**Not verified**
- Copy-sweep on the changed strings: not run as a skill. The new titles are Title Case with a colon, like **Update Available:**; the two older titles stay sentence case.
- The notes marker's tint in the real notes body: the component test stubs the body and reads the prop only.

**For you**
- Open the update dialog while a download runs: the title names the version and the footer shows **Close**.
- Decide whether **You're up to date** and **Couldn't check for updates** should move to Title Case with the rest.
