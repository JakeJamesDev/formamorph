# 12: Client: exclusive Mascot in the Mascot tab

Status: ready-for-agent
Blocked by: 06, 11
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: a new image reference kind through the mascot rendering path, plus read-only rules and fallback.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings.

## What to build

The Mascot tab shows each Supporter-only Mascot as a built-in, read-only entry beside Morphie. Its images use a new `supporter` reference kind that resolves through the Supporter content module and draws unscrambled layers. Edit, Duplicate, Export and Publish are refused for it (Q4). When the account doesn't qualify, the entry shows locked with the listing thumbnail and opens its Community Creations listing (Q8, Q15). For a Supporter, picking the locked entry installs it, then selects it (Q21). If the active Mascot is removed, the active id falls back to Morphie with no missing art (Q3).

The exclusive behaves like any other Mascot: looks, face calls, Voice and transitions.

## Acceptance criteria

- [ ] An installed exclusive draws, takes face calls and runs its transition like a custom Mascot.
- [ ] Edit, Duplicate, Export and Publish are absent or refused on it.
- [ ] A non-supporter's locked entry opens the listing; a Supporter's installs and selects.
- [ ] Removing the active exclusive falls back to Morphie.
- [ ] The Pages build (Community off) shows no exclusive entry.
- [ ] Component tests cover each case above (prior art: the FormaquestionMascotTab and Formaquestion mascot suites).
- [ ] Frames `.scratch/frames/mascot-tab-locked.png` and `.scratch/frames/mascot-tab-installed.png`, both themes, at 1440 wide.
- [ ] The Mascot docs page covers the Supporter Mascot.

For you: play a session with the exclusive installed and judge that it feels the same as Morphie.
