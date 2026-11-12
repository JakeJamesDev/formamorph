# 02: Send Funnel Steps per Source

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: one type change fans out to six call sites and a store with open and close state; the per-surface tests need care.

**What to build:** every entry point to The Road reports under its own source, and The Road credits its Patreon click and finished checklist to the source that opened it (Q1, Q4, Q8, Q9). The AI setup lead reports a shown step once per install (Q3). New builds send no legacy name (Q6). This ticket owns the client's source and step list, which ticket 03 reads.

- [ ] The client names the five sources and the valid step names once. The funnel step type is derived from that list, so an invalid pair is a type error.
- [ ] Opening The Road requires a source. Every caller passes one: the AI setup lead, both story cards, the Demo AI notice, and both locked-preset buttons. The store clears the source on close.
- [ ] See Levels sends `<source>_see_levels`. The Patreon click and the finished checklist send `<source>_patreon_click` and `<source>_checklist_finished` for the latest open's source. Opening from one source, closing, then opening from another credits the second.
- [ ] The AI setup lead sends `setup_offer_shown` the first time it shows on an install, and never again after a reload. Its seen record lives with the two cards' records.
- [ ] The Demo AI card sends `demo_offer_shown`. The built-in engine card still sends `engine_offer_shown`.
- [ ] No client code sends `offer_shown`, `see_levels`, `patreon_click` or `checklist_finished`.
- [ ] Each surface's test counts its POSTs by name, and one guard is shown to fail when a caller's source is dropped.
