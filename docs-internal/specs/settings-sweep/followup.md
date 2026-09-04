# Settings Sweep — Follow-Up

Status: ready-for-agent

Two issues found after the sweep shipped. Aligned via grilling, 2026-08-11. Status: **agreed, not started**.

## The problems

**1. Doubled descriptions on segmented rows.** Three rows render the picked option's `help` *and* the
row's `hint`, in the same size, weight, color and column — so they read as one confused block.

| Row | Row hint | Option help (System / Auto / Native) |
|---|---|---|
| Theme | Sets the app's light or dark color scheme. | Always uses the light color scheme. |
| Paragraph Limit | *(row hint)* | Recommended. Scales the paragraph count to your Max Output Tokens… |
| Thinking | Sets how the AI plans a turn before writing it. | Nothing is added to the prompt. Reasoning models think… |

Theme is the worst: the two lines say the same thing twice.

**2. The Experimental badge is illegible.** A bordered `text-[10px]` chip carrying `⚗` — too small to
read and too heavy for what it is.

## Agreed changes

### Commit 1 — Option copy moves into the copy module

- **Move `THEME_OPTIONS`, `PARAGRAPH_LIMIT_OPTIONS`, `THINKING_OPTIONS` wholesale** out of
  [SettingsModal.tsx:68](src/components/modals/SettingsModal.tsx:68) into
  [settingsCopy.ts](src/components/modals/settingsCopy.ts) — value, label, help, flags. Goal: **no
  user-facing strings left in the modal.**
- **Option help obeys R2 exactly**: one sentence, ends with a period, ≤ 12 words. Same predicates as
  `description`, applied by the guard.
- **Detail that doesn't fit is cut**, not relocated. "Highest quality, slowest." is enough to choose
  by; the cost detail is discoverable by use.
- **The row hint stops rendering on these three rows.** The label gains an `ⓘ` carrying the row
  description instead. The `description` key stays in `SETTINGS_COPY` — the guard is unchanged in that
  respect.
- **`recommended?: true` becomes a data flag**, mirroring `experimental`. The guard asserts
  `/recommended/i` never appears in help text — R6's exact shape, applied to option copy.

### Commit 2 — Markers become matched icons

- `⚗` → lucide **`FlaskConical`**, same size, stroke and `muted-foreground` as the `ⓘ`'s icon, sitting
  immediately left of it. No border, no padding, no chip.
- `recommended` renders as a lucide **`Star`/`Sparkles`** on the `ToggleGroupItem` itself, matched to
  the flask — so the recommendation is visible *before* you select the option, which it currently
  isn't.
- Hover `title` remains the only carrier of the Experimental caveat. Accepted: it's a caveat, not
  something you need to operate the setting.

## Deliberately not doing

- No `descriptionRendered` flag — the copy module doesn't track what renders where.
- No per-option `ⓘ`. Four info icons inside one segmented control is too much chrome.
- No text suffix inside the segmented items — four items already fill the row on mobile.
