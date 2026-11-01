# 01: Update Dialog Title per Phase

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one pure function, one component, and the dialog copy under the Writing Guide.

## What to build

While a download runs or waits, the update dialog says **You're up to date**, hides the new-version notes marker and offers **Check for updates** in place of the download control. Give the dialog one pure function that maps each update phase to its title, and use it. The downloading and downloaded phases name the update. The notes marker stays during them. Checking and idle get a title that is true for them.

This ticket owns the phase → title function. Ticket 02 builds on it.

Spec: Q11, Implementation Decisions "Update state". Evidence: docs-sweep ticket 01, Landed.

## Acceptance criteria

- [ ] A pure test of the phase → title function fails on today's mapping for the downloading and downloaded phases, then passes
- [ ] The dialog shows the update's version and its notes marker while downloading and once downloaded (component test)
- [ ] Each title string follows the Writing Guide (copy-sweep on the changed strings)
- [ ] The update dialog table on the Saves-and-Backup page lists every title; the docs tests are green
- [ ] A changelog fragment under Minor / Fixed / 👤
