# Per-World Prompt Preset Pin — Spec

**Status: SPECED (2026-08-06), not yet built.** Follows the per-world narration prompt (`world-narration-prompt-spec.md`, shipped). All decisions below are user-confirmed.

## Goal

Let a player run a given world on a specific prompt preset without changing their global choice. A world that wants terser narration, or a different section style, or its own sampler pins, can be pinned once and then just works every time it's entered.

**Local to the player's library.** No world-shape change, nothing exported, nothing published — a downloaded world never carries a pin, and pinning a world you later publish has no effect on anyone else.

## Decisions (interviewed & confirmed)

| Question | Decision |
|---|---|
| vs. the world's own narration prompt | **World prompt still wins.** The pin supplies the other 25 prompts; the world's authored narration prompt keeps overriding narration unless the player unticks the existing opt-out. Two independent controls. |
| Scope | **The whole preset** — prompts, section style, sampler pins, reasoning, verbatim turns. Identical to having switched presets globally. |
| Settings → Prompts while playing a pinned world | **Shows the pinned preset and edits it**, with a note that this world is pinned. Reverts to the global preset when the world closes. |
| Settings' preset *selector* while pinned | **Edits the pin.** Mid-pinned-world the dropdown changes what this world is pinned to; the global choice is untouched (and unreachable until the world closes). What's on screen is always what runs. "Save as new preset" pins the new preset likewise, and Share exports the preset on screen. |
| Deleted/renamed preset | **Falls back to the global preset, pin kept.** A dangling id reads as "no pin"; the dropdown shows *Use global preset*. |
| Footer layout | **Three separate controls.** Preset dropdown left; narration opt-out and README checkbox right-aligned. |
| When it applies | **Read on world load only**, like the narration opt-out. Changing it takes effect next entry. |
| Backup/Restore | **Not included** — consistent with README flags and hidden-world lists, which are also local-only. |
| Dropdown contents | *Use global preset* (default), then the three built-ins and every user preset — the same list Settings shows. |

## Data model

- `localStorage` key `FORMAMORPH_worldPromptPresets`: `Record<worldId, presetId>`. Absent world id = no pin.
- **No world-shape change.** Nothing touches `World`, `WorldOverview`, or the save envelope.

## Runtime resolution

Everything in `SettingsContext` already derives from `activeValues(presetStore, BUILTIN_VALUES)`, keyed on `presetStore.activeId`. The pin works by overriding *which id that resolution uses* for the duration of play:

1. Add a session-scoped override to `SettingsContext` (e.g. `sessionPresetId` + a setter). It is **never written to `presetStore.activeId`** — the player's global choice must survive untouched.
2. `GameViewer` sets it on world load (new game **and** save load — same mount) and clears it on unmount.
3. Resolve everything through an **effective store**: `{ ...presetStore, activeId: sessionPresetId ?? presetStore.activeId }`, fed to `activeValues`, `activeStyle`, the four tuning readers, **and the derived UI values** — `activePresetId`, `activePresetIsBuiltIn`, `activePresetName`, `exportActivePreset` all currently read the raw `activeId` and would otherwise show/export the wrong preset.
4. **Setters are NOT free.** `updateValue`/`patchActivePreset` key off `store.activeId`, so with the override outside the store they'd edit the global preset while displaying the pinned one. And naively injecting the effective id before the call persists the pin into `activeId`. The wrapper must inject-then-restore: `const patched = updateValue({ ...s, activeId: eff }, k, v); return { ...patched, activeId: s.activeId }`. A pinned built-in is read-only exactly as it is globally (`isBuiltInActive` on the effective store).
5. While pinned, `selectPreset` and `addPreset`'s auto-select write the **pin**, not `activeId` (per the decision above).

Resolution guard: a pinned id that is neither a built-in nor a stored user preset resolves to **no pin** (the global preset), not to the Default built-in — `activeValues`'s existing ghost-id fallback lands on Default, so the pin must be validated before it is applied.

The world's narration prompt is layered on top afterwards, unchanged: `resolveNarrationPrompt(overview, effectivePresetPrompt, optedOut)`.

## UI

**World details popup footer** — currently one left-aligned row.

```
[ Prompts: Use global preset ▾ ]        ☑ Use this world's narration prompt   ☑ Show Readme on entry
└── left                                                              right-aligned ──┘
```

- The dropdown always shows (unlike the two checkboxes, which are conditional), so the left side is never empty.
- Label the current state plainly: *Use global preset* when unpinned, the preset's name when pinned.
- MainMenu does not currently consume `useSettings` at all — the dropdown adds that dependency (it already sits inside the provider).

**Settings → Prompts** — when a pinned world is open, the preset selector shows the pinned preset with a short note that the current world is pinned to it. Editing behaves normally.

## Out of scope

- Changing the pin from inside a playthrough (it is read at load).
- Pinning per save rather than per world.
- Carrying pins through Backup/Restore or Community Creations.

## Build checklist

- [ ] `lib/worldPromptPreset.ts`: storage hook + validated resolution (dangling id ⇒ no pin)
- [ ] `SettingsContext`: effective-store resolution; every value/tuning reader, derived UI value (`activePresetId`/`IsBuiltIn`/`Name`, export), and setter (inject-then-restore) respects it; `selectPreset`/`addPreset` route to the pin while pinned
- [ ] `GameViewer`: set on load, clear on unmount
- [ ] World popup footer: dropdown left, checkboxes right-aligned
- [ ] Settings → Prompts: pinned-world note
- [ ] Tests: resolution + dangling id, global `activeId` never mutated, footer wiring
- [ ] Changelog In-Progress entry (👤). **No export-shape reminder needed — nothing leaves the device.**
