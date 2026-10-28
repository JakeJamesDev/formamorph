# 12: Client: exclusive Mascot in the Mascot tab

Status: done
Blocked by: 06, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: a new image reference kind through the mascot rendering path, plus read-only rules and fallback.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Builds on ticket 06's shared Mascot preset store (one state for every `useHelpSettings` instance) and its source-tracking fields.

## What to build

The Mascot tab shows each Supporter-only Mascot as a built-in, read-only entry beside Morphie. Its images use a new `supporter` reference kind that resolves through the Supporter content module and draws unscrambled layers. Edit, Duplicate, Export and Publish are refused for it (Q4). When the account doesn't qualify, the entry shows locked with the listing thumbnail and opens its Community Creations listing (Q8, Q15). For a Supporter, picking the locked entry installs it, then selects it (Q21). If the active Mascot is removed, the active id falls back to Morphie with no missing art (Q3).

The exclusive behaves like any other Mascot: looks, face calls, Voice and transitions.

## Acceptance criteria

- [x] An installed exclusive draws, takes face calls and runs its transition like a custom Mascot. `Formaquestion.supporterMascot.test.tsx` (canvas layers, Wink face call, two looks mid-transition); live in the preview, frames below.
- [x] Edit, Duplicate, Export and Publish are absent or refused on it. Refused by kind through `mascotAllows` (`supporterMascot.test.ts`); header shows only Import and full screen (`FormaquestionMascotTab.supporter.test.tsx`, DOM read in the preview); card export throws on `supporter` refs.
- [x] A non-supporter's locked entry opens the listing; a Supporter's installs and selects. `FormaquestionMascotTab.supporter.test.tsx` (signed in, signed out, Supporter, failed install).
- [x] Removing the active exclusive falls back to Morphie. `supporterMascotSync.test.ts`, `supporterMascot.test.ts` (reconcile) and the window suite (Morphie's images, no blank layer).
- [x] The Pages build (Community off) shows no exclusive entry. `useSupporterMascotListings.test.ts` (no catalog read); the sync starts only under `COMMUNITY_ENABLED` in `App.tsx`.
- [x] Component tests cover each case above (prior art: the FormaquestionMascotTab and Formaquestion mascot suites). Seven guards proven by reinstating each bug.
- [x] Frames `.scratch/frames/mascot-tab-locked.png` and `.scratch/frames/mascot-tab-installed.png`, both themes, at 1440 wide. Light twins carry `-light`. The locked frame has no thumbnail: the preview stubbed the catalog read.
- [x] The Mascot docs page covers the Supporter Mascot. `docs/Formaquestion.md`, Mascot section.

For you: play a session with the exclusive installed and judge that it feels the same as Morphie.

## Landed

**Not verified**
- Against the live server: production rejects `kind=mascot` until the server tickets deploy, so the catalog read and a real install were checked only with stubs and a hand-seeded cache.

**For you**
- For you: play a session with the exclusive installed and judge that it feels the same as Morphie.
- Look at the locked entry in the **Preset** list: thumbnail, name and lock in one row (`.scratch/supporter-content-12/frames/mascot-tab-locked.png`, `.scratch/supporter-content-12/frames/mascot-tab-locked-light.png`).
- Look at the installed exclusive's read-only tab (`.scratch/supporter-content-12/frames/mascot-tab-installed.png`, `.scratch/supporter-content-12/frames/mascot-tab-installed-light.png`).
- The locked entry reads only the first 50 Mascot catalog rows, pinned first. An unpinned exclusive past that page shows no locked entry.
- Spec Q41's ref shape gains `revision`: `{ kind: 'supporter', id, revision, index }`.
