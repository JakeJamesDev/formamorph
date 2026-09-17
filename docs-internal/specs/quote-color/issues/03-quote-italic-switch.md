# 03: Quote Italic Switch

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: low

Spec: `docs-internal/specs/quote-color/spec.md`

## What to build

A **Quote Italic** switch in the Appearance section, off by default, sets quoted speech in italic on
every surface that the quote span covers. It is independent of the color switch.

## Acceptance criteria

- [ ] The setting has a default of off and lives with the other settings defaults.
- [ ] The switch sits beside the color switch with copy per the settings copy rules.
- [ ] Italic applies with color off and with color on. The quote span exists when either switch is on.
- [ ] Italic respects the per-font italic skew tuning the way other italic text does.
- [ ] A GamePanels harness test covers italic on with color off.
- [ ] Verified in the preview via the dev-router.
- [ ] Changelog In-Progress entry. Four gates green.
