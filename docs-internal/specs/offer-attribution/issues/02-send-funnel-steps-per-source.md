# 02: Send Funnel Steps per Source

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: one type change fans out to six call sites and a store with open and close state; the per-surface tests need care.

**What to build:** every entry point to The Road reports under its own source, and The Road credits its Patreon click and finished checklist to the source that opened it (Q1, Q4, Q8, Q9). The AI setup lead reports a shown step once per install (Q3). New builds send no legacy name (Q6). This ticket owns the client's source and step list, which ticket 03 reads.

- [x] The client names the five sources and the valid step names once. The funnel step type is derived from that list, so an invalid pair is a type error. `funnel.test.ts` › lists each source with its own steps (`@ts-expect-error` on `notice_offer_shown`, `locked_offer_shown` and the legacy names).
- [x] Opening The Road requires a source. Every caller passes one: the AI setup lead, both story cards, the Demo AI notice, and both locked-preset buttons. The store clears the source on close. Typecheck (required parameter); `roadSceneSource()` read in `DemoAINotice.test.tsx`, `HostedPresetStatus.test.tsx`, `GameViewer.engineCard.test.tsx`; the clear on close is guarded by `SupportChecklist.test.tsx` › sends nothing from a scene no entry point opened.
- [x] See Levels sends `<source>_see_levels`. The Patreon click and the finished checklist send `<source>_patreon_click` and `<source>_checklist_finished` for the latest open's source. Opening from one source, closing, then opening from another credits the second. `SupportChecklist.test.tsx` › Support checklist funnel steps (four cases), plus each surface's See Levels test. Locked See Levels sends `locked_see_levels` (Q13).
- [x] The AI setup lead sends `setup_offer_shown` the first time it shows on an install, and never again after a reload. Its seen record lives with the two cards' records. `AiSetupGate.test.tsx` › sends its shown step on its first show, and never again after a reload; `FORMAMORPH_setupLeadSeen` in `firstTimeFlowStore.ts`.
- [x] The Demo AI card sends `demo_offer_shown`. The built-in engine card still sends `engine_offer_shown`. `useDemoAIOffer.test.tsx` (both cards' POST lists) and `GameViewer.storyCard.test.tsx`.
- [x] No client code sends `offer_shown`, `see_levels`, `patreon_click` or `checklist_finished`. The type refuses them (`funnel.test.ts`); every surface test lists its POSTs exactly.
- [x] Each surface's test counts its POSTs by name, and one guard is shown to fail when a caller's source is dropped. Shared `src/test/funnelPosts.ts`. Mutations, each restored: notice → `demo` fails the notice test; engine card → `demo` fails `GameViewer.engineCard.test.tsx`; no clear on close fails the no-source case; no seen-record check fails the setup lead's reload case.

## Landed

**Not verified**
- None. The engine card's click test mocks when the card shows; when it shows stays `useDemoAIOffer.test.tsx`'s.

**For you**
- Deploy FormamorphServer with ticket 01's step list before a client build ships this, or each install loses its one-time send of the new names.
