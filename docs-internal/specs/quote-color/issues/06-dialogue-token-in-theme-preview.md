# 06: Dialogue Token in the Theme Preview

Status: ready-for-human
Status note: Built in 3d9b102d and its review follow-up. The by-eye review of the 16 values is the user's step; no value changed yet.
Base: 38306acb
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: low

Spec: `docs-internal/specs/quote-color/spec.md`

## What to build

The theme preview dialog lists `--dialogue` with the other tokens, with a swatch and hex, so the 16
values can be tuned in place. The user approves the final values by eye.

## Acceptance criteria

- [ ] The token appears in the theme preview token list with the existing swatch and hex controls.
- [ ] The preview shows a sample line with a quote so the token is judged against body text.
- [ ] The 16 values are reviewed with the user in the preview, and any adjustments land in the theme CSS.
- [ ] Verified in the preview via the dev-router in both modes.
- [ ] Four gates green.
