# 02: Pin The Quick Reference On Code Turns

Status: ready-for-agent
Blocked by: 01 — Quick Reference Section
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a change to how the help session picks sections, with ordering and budget rules; the existing session tests are the seam.

## What to build

A player who asks a code question gets the Quick Reference in every answer request. On the stat Code tab, the lead stays Dynamic Value Calculation and the Quick Reference is always the second section; retrieval fills the rest under the existing limits. On a code turn from any other screen, the Quick Reference takes the lead's slot and the "first guide section explains this screen" line is left out of that turn. A non-code turn is unchanged. AI Context shows the pinned section among the sent sections.

## Acceptance criteria

- [ ] On the Code tab, sent sections read lead, Quick Reference, then retrieval hits, within the 5-section and size limits
- [ ] On a code turn from another surface, the Quick Reference is first and the screen line is absent
- [ ] A non-code turn sends the same sections as before
- [ ] The Quick Reference is never sent twice when retrieval also finds it
- [ ] Changelog fragment written
