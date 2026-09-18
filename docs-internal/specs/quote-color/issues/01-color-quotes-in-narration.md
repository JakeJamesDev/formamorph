# 01: Color Quotes in Narration and the Player Echo

Status: ready-for-human
Status note: Built in 6ce3862a. Two criteria changed during the build; see Comments.
Base: 77ee0e9f
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

- [x] A pure quote segmenter splits text into quoted and plain segments: straight `"` toggles, `“` opens, `”` closes, single quotes and other marks are plain, an unclosed quote runs to the end of its input.
- [x] A rehype plugin wraps quoted runs in a span with one class, per paragraph-level block, across inline bold and italic, and skips code.
- [x] The renderer takes a prop that selects the plugin set; the plugin arrays stay module constants.
- [x] Narration (live and history) and the player echo pass the prop. Reasoning, command preview, and non-game panes do not.
- [~] The sanitize allowlist accepts the span class. NOT DONE, deliberately; see Comments.
- [x] Every theme block, light and dark, defines `--dialogue`; the CSS on the span reads it. The values are proposed per theme hue and read as text in all 16 cases.
- [x] The setting has a default of on, lives with the other settings defaults, and the switch sits next to the narration text controls with copy per the settings copy rules.
- [x] With the switch off the span carries no visible style.
- [x] Tests at three seams: segmenter unit tests, a renderer test with the prop on and off, and a GamePanels harness test for narration, echo, and the plain surfaces. Each guard is proven by reinstating the failure once.
- [x] Verified in the preview via the dev-router in light and dark on at least three themes, including high-contrast.
- [x] Changelog In-Progress entry. Four gates green.

## Comments

**The sanitize allowlist is not touched, on purpose.** The quote plugin runs last in the renderer's
rehype array, after `sanitize` and `harden`, the same placement `rehypePreviewTint` already uses. Its
spans are created after the sanitizer runs, so they never pass through it and need no allowance.
Allowlisting `className` on `span` would instead let author markdown carry arbitrary classes through raw
HTML, which is a loosening for no gain. `spec.md` line 112 still says the allowlist gains the class; the
spec owner may want to correct it.

**An unclosed quote ends at the line break, not at the paragraph.** `remarkBreaks` keeps a single newline
inside the paragraph as a `<br>`, and models write line-separated sentences, so the paragraph rule let one
dropped closing mark color every line down to the blank line. The user chose the line-break rule. Its
cost: a quote that genuinely spans a soft break reads as one quote per line, and the closing mark on the
second line reads as an opener, so it colors the rest of that line. Nothing in the text tells a stray
closer from an opener, and a rule that looked ahead would change a run's color as it streamed, which
breaks the spec's story 19.

**Theme values.** The sixteen `--dialogue` values are proposed, not approved. Measured against the
narration panel they run from 5.53:1 (monochrome light) to 10.65:1 (high-contrast light), and each is
distinct from its theme's `--foreground`. Ticket 06 puts the token in the theme preview so they can be
tuned by eye.

**Preview check.** Ran on the `whiteRoom` dev fixture with a turn temporarily rewritten to carry dialogue:
narration, the player echo, bold inside a quote, all eight themes in both modes, and the switch off. The
fixture edit was reverted.
