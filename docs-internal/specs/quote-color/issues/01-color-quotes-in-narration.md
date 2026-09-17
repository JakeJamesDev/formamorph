# 01: Color Quotes in Narration and the Player Echo

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/quote-color/spec.md`

## What to build

Quoted speech in narration and in the player's echoed text shows in the dialogue color. The color comes
from a new `--dialogue` theme token with a value for every theme in light and dark. A **Quote Color**
switch in the Appearance section turns it off; it is on by default. The reasoning block, the command
preview, and every non-game markdown pane stay plain.

## Acceptance criteria

- [ ] A pure quote segmenter splits text into quoted and plain segments: straight `"` toggles, `“` opens, `”` closes, single quotes and other marks are plain, an unclosed quote runs to the end of its input.
- [ ] A rehype plugin wraps quoted runs in a span with one class, per paragraph-level block, across inline bold and italic, and skips code.
- [ ] The renderer takes a prop that selects the plugin set; the plugin arrays stay module constants.
- [ ] Narration (live and history) and the player echo pass the prop. Reasoning, command preview, and non-game panes do not.
- [ ] The sanitize allowlist accepts the span class.
- [ ] Every theme block, light and dark, defines `--dialogue`; the CSS on the span reads it. The values are proposed per theme hue and read as text in all 16 cases.
- [ ] The setting has a default of on, lives with the other settings defaults, and the switch sits next to the narration text controls with copy per the settings copy rules.
- [ ] With the switch off the span carries no visible style.
- [ ] Tests at three seams: segmenter unit tests, a renderer test with the prop on and off, and a GamePanels harness test for narration, echo, and the plain surfaces. Each guard is proven by reinstating the failure once.
- [ ] Verified in the preview via the dev-router in light and dark on at least three themes, including high-contrast.
- [ ] Changelog In-Progress entry. Four gates green.
