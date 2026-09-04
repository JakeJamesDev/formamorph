# 05 — Player-facing UI prototype

Type: prototype
Status: done
Status note: reactions captured 2026-08-20
Blocked by: 02

## Question

Raise fidelity on the player-facing surfaces with a cheap prototype to react to:

- The persistent event banner (main menu + CC header): size, placement, both themes, mobile.
- The start/end acknowledge modal.
- The Contest tab in Community Creations: contest header (title, dates, rules), entry grid (shuffled), winner-picked state, archive state.
- The "Enter into contest" toggle inside the publish flow.

Link the prototype as an asset; capture the reactions as the answer.

## Prototype (2026-08-20)

Asset: [assets/05-player-ui-prototype.html](../assets/05-player-ui-prototype.html) · published: https://claude.ai/code/artifact/7d0a3ce1-da8c-49e5-96b0-653aa2408e34

Standalone HTML mock (not in-app variants — nothing of the feature exists in code yet). Styling
mirrors `src/index.css` tokens + the tailwind type roles; layout mirrors MainMenu / CC browser /
PublishModal structure per [research/client-surfaces.md](../research/client-surfaces.md).

Controls: floating bottom bar — screen tabs, ←/→ variant cycling (keyboard works), contest-state
(live/winner/archive) and ack-phase (start/end) sub-toggles, theme + mobile (390px frame) toggles.

Variants per surface:

| Surface | A | B | C |
|---|---|---|---|
| Menu banner | Strip (thin info-tinted ribbon) | Card (title, dates, blurb, buttons) | Floating chip (right-aligned pill) |
| Contest tab | Hero header (rules inline) | Info rail (sticky sidebar) | Slim bar + rules dialog |
| Publish toggle | Checkbox row below options | Opt-in card with switch | Third publish option (radio) |
| Ack modal | Standard dialog | Poster dialog (gradient hero) | Corner/bottom sheet, non-blocking |

Banner hides in the archive state (event no longer active); winner state re-tints it to the
announcement. Contest grid shuffles per render in live state, pins the winner first afterward.

## Reactions (the answer — 2026-08-20)

- **Menu banner: B**, with buttons **Dismiss | View Entries**. Dismiss collapses the banner into
  design C's chip, which **names the contest**; clicking the chip opens the contest tab. (So C is
  not a competing variant but the banner's dismissed state.)
- **Contest tab: C** (slim bar + rules dialog) — but **drop the "shown in a different order every
  visit" note**. The per-visit shuffle is implementation knowledge, not player-facing copy.
- **Publish toggle: B** (opt-in card with switch).
- **Ack modal: B** (poster dialog).

The mock now defaults to the picked variants and demonstrates the dismiss → chip → contest-tab
flow; losing variants remain cyclable for reference.
