# Prompt Editor Split View (B2 + S2 + M2) — Spec

**Status: SPECED (2026-08-06), not yet built.** The chosen slice of the prompt-editor UX exploration (mockups: the "Prompt Editor UX Options" artifact; measurements in that page's baseline notes). All decisions below are user-confirmed.

## Goal

Editing a 1,500px prompt in a 384px window (26% visible on desktop, 10% on mobile) is the pain. The fix is one refactor with three faces:

- **B2** — Edit and Preview become two scroll-synced panes side by side where there's width.
- **S2** — every `PromptField` gains a maximize button opening the same field fullscreen.
- **M2** — on mobile, focusing a cramped inline editor opens that fullscreen automatically, with **M3**'s swipe between Edit and Preview inside it.

## Decisions (interviewed & confirmed)

| Question | Decision |
|---|---|
| Width for the inline split | **S1 rides along**: the Settings dialog widens to ~1100px while the Prompts tab is active. Split shows inline there and in the fullscreen overlay. |
| Split vs tabs gating | **Auto by container width, with a manual override.** Width decides the default (split when each pane gets ~420px+); a toolbar toggle forces tabs/split and is remembered. |
| S2 scope | **Every PromptField** — Settings prompts, world narration prompt, world description/readme, dictionary entries. One affordance everywhere. |
| Mobile package | **M2 fullscreen + M3 swipe + auto-fullscreen on focus.** **M1 (dropdown prompt picker) deliberately excluded** — the wrapped tab bar stays for now. |

## Architecture

The heart is a `PromptField` refactor from "two tabs" to "two panes + one layout decision":

1. **Panes.** Edit (Lexical chips) and Preview (rendered) become layout-independent children sharing the existing `ScrollAnchor` proxy — the same height-independent anchor that today survives tab switches becomes a live bidirectional sync (scrolling either pane updates the proxy; the other follows).
2. **Layout modes**, chosen per render:
   - `split` — panes side by side. Auto when the field's own container width gives each pane ≥ ~420px (a `ResizeObserver` on the field, **not** `useIsMobile` — a shrunken desktop window falls back to tabs, and mobile falls out for free).
   - `tabs` — today's toggle, for narrow containers and as the manual override.
   - `fullscreen` — the same component re-rendered in an overlay (Radix Dialog, ~95vw/95dvh); inside it the same auto gating applies, so a desktop fullscreen shows the split and a mobile fullscreen shows swipeable panes.
3. **Manual override** — a toolbar toggle (split ⇄ tabs) stored once globally (localStorage); auto stays the default until the user touches it.
4. **Swipe (mobile fullscreen)** — horizontal swipe between the two panes with pane dots; the shared anchor lands the target pane at the same content position. Reuse the existing swipe-pane conventions (SwipeImage / mobile drawers) rather than a new gesture lib.
5. **Auto-fullscreen on focus** — mobile only (here `useIsMobile` *is* right — it's about the device's editing ergonomics, not container width): focusing an inline `PromptField` opens the fullscreen with the caret preserved; closing returns to the inline field. The ⛶ button still exists everywhere.

### Surfaces touched

- [PromptField.tsx](../src/components/prompt/PromptField.tsx) — the whole refactor lives here.
- [SettingsModal.tsx](../src/components/modals/SettingsModal.tsx) — S1 conditional width on the Prompts tab (`sm:max-w-[800px]` → ~1100px while active); nothing else structural.
- Every `PromptField` call site inherits the button with no prop changes; `resizable` fields keep their drag handle.

### Constraints

- **Read-only built-ins stay read-only** in every mode; fullscreen and split are views, not edit-permission changes.
- **No world/save shape change, no prompt text change** — this is chrome. No probe run needed; the preview renders the same `previewValues` it does today.
- Preview updates live from the controlled value (debounced if typing lags — implementation call).
- Reduced-motion: the fullscreen open and pane swipe respect `prefers-reduced-motion`.

## Out of scope (deliberate)

- **M1** dropdown prompt picker (user chose to keep the tab bar).
- S3 merged chrome rows, S4 section jump, B1 workshop view, B3 master-detail, B4 section outline — shelved unless this still feels cramped.

## Build checklist

- [ ] `PromptField`: pane extraction + bidirectional scroll sync (anchor proxy goes live)
- [ ] Auto gating by container width + persisted manual override toggle
- [ ] Fullscreen overlay mode (⛶ on every field; Radix dialog; Esc/✕ close)
- [ ] Mobile: auto-fullscreen on focus (caret preserved), swipe panes + dots
- [ ] SettingsModal: S1 conditional width
- [ ] Tests: gating thresholds, override persistence, sync math (pure-function parts); existing `MarkdownPanel.swap` / PromptField tests stay green
- [ ] verify-ui at 1280×860 and 375×812, both the dialog and world-editor call sites; reduced-motion check
- [ ] Changelog In-Progress entry (👤). No export-shape reminder — nothing leaves the device.
