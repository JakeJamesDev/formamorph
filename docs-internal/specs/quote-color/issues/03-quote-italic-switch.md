# 03: Quote Italic Switch

Status: ready-for-human
Base: 7e2c092e
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: low

Spec: `docs-internal/specs/quote-color/spec.md`

## What to build

A **Quote Italic** switch in the Appearance section, off by default, sets quoted speech in italic on
every surface that the quote span covers. It is independent of the color switch.

## Acceptance criteria

- [x] The setting has a default of off and lives with the other settings defaults.
- [x] The switch sits beside the color switch with copy per the settings copy rules.
- [x] Italic applies with color off and with color on. The quote span exists when either switch is on.
- [x] ~~Italic respects the per-font italic skew tuning the way other italic text does.~~ Superseded, see Comments.
- [x] A GamePanels harness test covers italic on with color off.
- [x] Verified in the preview via the dev-router.
- [x] Changelog In-Progress entry. Four gates green.

## Comments

- **Skew criterion superseded (spec session, 2026-09-17).** The quote span takes real `font-style: italic` only, with no skew transform. The skew rule needs `inline-block`, which stops a sentence-long quote wrapping. A picked choice keeps italic: "plain" in the spec means color only.
- **Review follow-ups, not fixed here.** The test guards the `data-quote-italic` wiring and the span, not the CSS rule; jsdom does not load `index.css`, and the preview check covered the computed style. `SettingsContext` now has four copies of the root-attribute toggle effect; a `useRootFlag(name, on)` hook would gather them.
