# Quote Color — Spec

Status: ready-for-agent
Spec session: Quoted text color settings

Quoted speech in the game view takes its own color, so dialogue stands apart from narration. The color
follows the theme by default. The player can set a custom color for each mode and can set quotes in
italic. The work also ships the app's standard color picker.

## Problem Statement

A turn of narration mixes description and speech in one block of one color. The player scans for the
quotation marks to find who said what. Long turns with several speakers are slow to read. Other AI text
games color dialogue, and players ask for the same here.

The app also has no standard color picker. Three surfaces use the browser's native color input. The
native input looks different on each OS and is poor on mobile.

## Solution

- **Quoted text has a color.** In narration, the player echo, and choice buttons, the text from an opening
  double quote through its closing double quote shows in the dialogue color. The marks take the color too.
- **The color follows the theme.** Every theme defines a dialogue color for light and for dark. The
  feature is on by default.
- **The player can pick a custom color.** One custom color per mode. The setting shows the field for the
  active mode only. **Reset to Theme** clears the custom value for that mode.
- **The player can set quotes in italic.** A separate switch, off by default. It works with or without
  the color.
- **A standard color picker.** A swatch button opens a popover with a saturation square, a hue bar, a hex
  text field, and **Reset to Theme**.

## User Stories

1. As a player, I want quoted speech in a different color from narration, so that I find dialogue at a glance.
2. As a player, I want the dialogue color to match my theme, so that it looks correct with no setup.
3. As a new player, I want quote coloring on by default, so that I get the benefit before I find the setting.
4. As a player, I want to turn quote coloring off, so that narration reads as plain prose.
5. As a player, I want to pick a custom dialogue color, so that the game view matches my taste.
6. As a player, I want a separate custom color for light mode and dark mode, so that my color reads well in both.
7. As a player, I want the setting to show the color for the mode I use now, so that I edit what I see.
8. As a player who switches between light and dark, I want each mode to keep its own custom color, so that a switch never gives unreadable text.
9. As a player, I want a **Reset to Theme** button, so that I return to the theme color without guessing its value.
10. As a player, I want a custom color in one mode to leave the other mode on the theme color, so that I only change what I chose to change.
11. As a player, I want to type or paste a hex value, so that I use an exact color.
12. As a player, I want an invalid hex entry to leave my current color in place, so that a typing mistake breaks nothing.
13. As a player, I want the narration to update while I drag in the picker, so that I judge the color against real text.
14. As a player, I want an italic option for quotes, so that dialogue also differs by shape.
15. As a player, I want italic without color, so that I keep a single-color page with a quieter cue.
16. As a player, I want italic and color together, so that dialogue is as distinct as possible.
17. As a player, I want straight and curly double quotes both recognized, so that the color works with any model's typography.
18. As a player, I want apostrophes and single quotes left alone, so that contractions and possessives never color by mistake.
19. As a player, I want streaming text inside an open quote colored as it arrives, so that the text never changes color when the closing mark lands.
20. As a player, I want a quote the model forgot to close to color only to the end of its paragraph, so that one mistake never colors the rest of the turn.
21. As a player, I want bold and italic markdown inside a quote to keep working, so that emphasis in speech survives.
22. As a player, I want a quote that contains bold or italic runs colored as one quote, so that emphasis does not break the color.
23. As a player, I want code spans and code blocks left uncolored, so that code stays code.
24. As a player, I want past turns colored the same as the live turn, so that the history reads consistently.
25. As a player, I want my own submitted text colored where I wrote speech in quotes, so that my lines match the characters' lines.
26. As a player, I want quoted speech inside choice buttons colored, so that a spoken choice is clear before I pick it.
27. As a player, I want bold text inside a choice to keep working next to a colored quote, so that choices lose nothing.
28. As a player, I want the model's reasoning block left plain, so that only story text has dialogue styling.
29. As a player, I want the command preview left plain, so that only story text has dialogue styling.
30. As a player, I want the changelog, messages, world cards, and other markdown panes unchanged, so that the setting affects the game view only.
31. As a player on the high-contrast theme, I want a dialogue color that keeps the theme's contrast, so that accessibility holds.
32. As a player on the monochrome theme, I want a dialogue tone that fits the gray palette, so that the theme stays monochrome.
33. As a mobile player, I want the picker to work by touch, so that I set a color without a desktop.
34. As a keyboard user, I want to open the picker, move the color, and close it from the keyboard, so that the control is accessible.
35. As a player who uses TTS, I want speech output unchanged, so that a visual setting never alters audio.
36. As a theme designer, I want the dialogue color in the theme preview token list, so that I tune it with the other tokens.
37. As a developer, I want one shared color picker component, so that future color settings look and behave the same.
38. As a developer, I want the picker free of any game or settings dependency, so that any surface can use it.
39. As a developer, I want one quote segmenter that markdown text and choice text share, so that both surfaces pair quotes by the same rule.
40. As a developer, I want the quote span to be the single styling hook, so that per-speaker colors can attach to it later.

## Implementation Decisions

**Settings**

- Four new user settings: quote color on/off (default on), quote italic on/off (default off), custom
  light color (default unset), custom dark color (default unset). Defaults live with the other settings
  defaults. None has an environment-variable twin.
- Custom colors store as 6-digit hex strings. Unset means "follow the theme".
- The settings are app settings. World and save export shapes do not change.
- The controls sit in the Appearance section next to the narration text controls: a switch for color, the
  picker field for the active mode, and a switch for italic. The picker field is hidden while color is
  off.

**Theme token**

- A new `--dialogue` token in every theme block, light and dark, 16 values. It uses the same HSL-triple
  form as the other tokens. The values are proposed per theme hue and the user approves them visually
  before the work is handed over.
- The theme preview dialog lists the token with the others.
- The settings layer writes the active mode's custom color onto the document root as an override, the way
  the narration scale and line-height already reach CSS. With no custom color the theme token applies.

**Quote segmenter**

- One pure function splits a text run into quoted and unquoted segments. Rules: straight `"` toggles; `“`
  opens and `”` closes; single quotes, guillemets, and CJK marks are plain text; an unclosed quote runs to
  the end of the input it was given.
- The markdown path and the choice path both call it.

**Markdown path**

- A rehype plugin wraps quoted runs in a span with one class. It works per paragraph-level block, so an
  unclosed quote ends with its block. A quote that crosses inline elements (bold, italic) stays colored
  across them. Text inside code elements is skipped.
- The plugin array must stay a module constant, because the streaming renderer memoizes on its identity.
  A renderer prop selects the array that includes the quote plugin. Narration and the player echo pass the
  prop. The reasoning block, the command preview, and every non-game pane do not.
- The sanitize allowlist gains the span class.
- Color and italic apply through CSS on the span class, gated by root attributes or variables the settings
  layer sets. With both switches off the spans carry no visible style.

**Choice path**

- Choice buttons are not markdown. The existing manual bold split gains a quote pass that uses the same
  segmenter and the same span class.

**Color picker**

- New dependency: `react-colorful`. Confirm the latest version and package identity from the registry at
  build time.
- A shared component: swatch trigger button, popover with the saturation square and hue bar, a hex text
  field, and an optional reset action whose label the caller supplies. Props are value, change handler,
  and reset handler. No alpha. No preset swatches.
- The hex field commits only valid 6-digit values. An invalid entry keeps the last valid color.
- The popover follows the existing popover-in-dialog scroll-lock convention, because the settings surface
  is a dialog.
- The component gets an entry in the design-system showcase.

**Copy**

- Setting lines and tips follow the settings copy rules: brief line decides, tip defines. Labels use title
  case.

## Testing Decisions

A good test here asserts what the player sees: which text carries the dialogue span, and which does not.
It never asserts plugin internals or CSS variable names.

- **Quote segmenter (pure).** Pairing of straight quotes, curly quotes, mixed marks, apostrophes inside and
  outside quotes, an unclosed quote, empty quotes, adjacent quotes. Prior art: the preview-tint plugin's
  unit tests.
- **Markdown renderer.** With the prop on: a quote across a bold run is one colored quote, code is skipped,
  an unclosed quote stops at its paragraph. With the prop off: no spans. Prior art: the renderer's
  highlight test.
- **GamePanels harness.** Real providers. Narration, the player echo, and choices carry spans. The
  reasoning block and command preview do not. Turning the color setting off removes the visible styling
  hook. A custom color for the active mode reaches the root. Prior art: the GamePanels test harness.
- **Color picker component.** Hex entry commits, invalid hex does not, reset fires, the swatch shows the
  value. No game providers.
- Each guard is proven by reinstating the failure once, per the test bar.
- UI verification uses the dev-router and static frames in both modes and at least three themes,
  including high-contrast.

## Out of Scope

- Gendered or per-speaker quote colors. See `docs-internal/specs/gendered-quote-colors/spec.md`.
- Moving the three native color inputs to the new picker. See `docs-internal/specs/color-picker-migration/spec.md`.
- Single quotes, guillemets, and CJK quotation marks.
- Alpha and preset swatches in the picker.
- Per-world or author-set dialogue colors.
- Any prompt change. The feature reads the text the model already writes.

## Further Notes

- The light themes' `--primary` is a pastel and fails as text on a light background. `--ring` equals the
  body color in two light themes. That is why the theme color is a new token and not a reused one.
- A user-facing changelog entry goes in the In-Progress section.
- The quote span is the seam for the gendered follow-up: a per-speaker color would set an attribute on the
  same span.
