# Markdown Highlight Syntax

Status: ready-for-agent

## Problem Statement

Text rendered through the app's markdown pipeline — community comments, feedback threads, world descriptions, readmes, narration — has no way to highlight or color a span of text. The `==highlight==` convention that users know from Obsidian renders as literal equals signs, raw HTML like `<mark>` is stripped by the sanitizer, and the only mark-shaped rendering in the app (placeholder chip tints) is an internal provenance mechanism that text content deliberately cannot reach. A commenter who wants to call out a phrase, or a world author who wants color emphasis in a readme, has nothing.

## Solution

Adopt the Obsidian highlight standard across every markdown surface: `==text==` renders as a themed highlight, and a single-letter color key (`=r=text==`) selects one of nine named colors. The base highlight is colored from the active theme's primary token, so it always looks native to whichever of the app's themes (and light/dark modes) is active. The nine color keys are fixed translucent hues that read correctly over any theme background. A highlighter button joins the markdown formatting toolbar, and a new wiki page documents the full supported formatting set.

## User Stories

1. As a commenter, I want to wrap text in `==` to highlight it, so that I can call attention to a phrase in my comment.
2. As a commenter, I want `=r=text==` to render a red highlight, so that I can color-code my feedback.
3. As a world author, I want highlights in my world description and readme, so that key rules and warnings stand out to players.
4. As a world author, I want the highlight syntax I know from Obsidian to work identically here, so that I can paste notes from my vault without rewriting them.
5. As a player, I want highlights to appear in the theme's own colors, so that highlighted text never clashes with the theme I picked.
6. As a player using dark mode, I want highlights readable over dark backgrounds, so that highlighted text doesn't cost me contrast.
7. As a player on any of the eight theme palettes, I want the base highlight to follow that theme's primary color, so that highlights always look intentional rather than default-yellow.
8. As a world author, I want a highlighter button in the markdown toolbar, so that I can highlight a selection without knowing the syntax.
9. As a world author, I want unstyled color keys to fall back to the base highlight rather than break, so that a typo'd key still renders as a highlight.
10. As a world author using the editor's Preview tab, I want my highlights and the placeholder chip tints to look visibly different, so that I can tell authored emphasis from resolved chip values.
11. As a world author, I want edit↔preview scroll sync to keep working when my text contains highlights, so that the preview still follows my caret.
12. As a reader of AI narration, I want any `==` the model happens to emit to render as a clean highlight, so that stray syntax never shows as literal punctuation.
13. As a user, I want a wiki page listing the supported formatting including the color-key table, so that I can learn the syntax without trial and error.
14. As a user writing prose containing `a==b` style expressions with spaces around them, I want those left alone, so that technical text doesn't sprout accidental highlights.
15. As a developer, I want the highlight alphas defined once as variables, so that tuning intensity is a one-line change.
16. As a maintainer, I want the color classes to carry no inline styles, so that the sanitizer posture stays unchanged.

## Implementation Decisions

- **Plugin**: `remark-flexible-markers` (verified current, unified 11), added to the shared remark plugin array in the markdown renderer — every surface that renders markdown gains the syntax at once. Delimiter stays the default `==` for Obsidian compatibility.
- **Sanitizer**: the `mark` tag is absent from Streamdown's default sanitize schema, so the renderer passes Streamdown's first-class `allowedTags` prop allowing `mark` with `className`. No inline styles are allowlisted; the plugin emits classes only.
- **Class scheme**: keep the plugin's class output (a shared marker class plus a per-color secondary class). All styling lives in the app stylesheet.
- **Base highlight** (`==text==`, and any color key we don't style): background `hsl(var(--primary) / var(--md-hl-alpha-base))` — themed by the primary token, so it adapts across all 8 theme palettes × light/dark automatically. Never browser-default yellow.
- **Nine styled color keys**, letters matching color initials: r red `#ef4444`, o orange `#f97316`, y yellow `#eab308`, g green `#22c55e`, c cyan `#06b6d4`, b blue `#3b82f6`, p purple `#a855f7`, q pink `#ec4899`, x gray `#737373`. Each is stored as an RGB-triplet CSS variable and composed with a shared `--md-hl-alpha` (initial value 0.45), so hue and alpha each tune as a one-line edit. Translucent backgrounds with inherited text color make one rule set work over every theme background. Design approved from a rendered preview built with the app's real tokens.
- **Chip-tint separation** (author preview panes): tint marks gain a `data-tint` attribute in both the plain pane and the rehype tint plugin; the edit↔preview scroll-sync anchor selector narrows from `mark` to `mark[data-tint]` so author highlights can't interleave into the chip anchor ordering (a correctness fix, needed regardless of styling). Visually, author highlights use the fuller-opacity highlighter treatment above while chip tints keep their translucent rounded look.
- **Toolbar**: one plain highlighter action in the markdown formatting toolbar that wraps the selection in `==…==`, implemented as a pure transform like the existing actions. No color menu; color keys are typed syntax.
- **AI prompts untouched**: no prompt text changes, so no probe cycle. Models emitting `==` simply render correctly; encouraging the AI to highlight is a separate future change.
- **Empty-content handling**: the plugin's empty markers are not wanted; configure empty content to be removed rather than rendered as an empty mark.
- **Docs**: new wiki page ("Text Formatting") in `docs/` covering the supported markdown set — emphasis, strikethrough, sub/super, highlight, and the color-key table — plus a sidebar entry. Wiki publishes automatically on merge.
- **No export-shape, save-shape, or version changes.** This is pure rendering plus one toolbar action.

## Testing Decisions

- Good tests here assert **external rendering behavior** — what HTML classes and structure come out of real input strings — never plugin internals or CSS values.
- **Renderer seam (highest, new test file)**: render the markdown renderer component with `==text==`, `=r=text==`, an unstyled key, a no-space `a==b` case, and highlight-inside-emphasis; assert the emitted mark elements and classes. This one seam proves the remark plugin, the sanitizer `allowedTags` passage, and the class mapping together. Prior art: the PromptField markdown preview tests, which render through the same component in jsdom.
- **Tint plugin seam (existing)**: extend the preview-tint unit tests to assert the `data-tint` attribute on tinted and empty marks.
- **Scroll-sync seam (existing)**: extend the PromptField preview tests with a mutation-proven guard — author highlights interleaved between chips must not shift the chip↔mark anchor correspondence; the test must fail if the anchor selector is reverted to bare `mark`.
- **Toolbar seam (existing)**: the highlight action joins the markdown-toolbar pure-transform tests alongside bold/italic.
- UI verification per the standard bar: live preview at realistic viewport, both light and dark, static-frame evidence.

## Out of Scope

- Arbitrary color values (`=#ff0000=` or similar) — the palette is the nine named keys plus the themed base, hard-capped by the plugin's single-letter design at 26.
- A toolbar color picker/swatch menu.
- Prompt-side encouragement of AI highlighting (would require the full probe workflow).
- Highlight support in non-markdown surfaces (plain-text fields, chip-only preview panes).
- Any changes to world/save export shapes or versions.

## Further Notes

- The plugin's known false-positive (`a==b and c==d` with no spaces highlights "b and c") is accepted as-is for Obsidian compatibility; the docs page can note it.
- Bundled default worlds were scanned: no existing `==…==` text, so no shipped-content rendering change.
- The community comment and feedback-thread surfaces inherit the syntax with zero extra work because they already render through the shared markdown renderer.
- Alpha tuning: `--md-hl-alpha` (colors) and `--md-hl-alpha-base` (primary base) are single CSS variables by design, per explicit user request.
