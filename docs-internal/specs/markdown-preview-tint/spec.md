# Markdown Preview Placeholder Tinting

Status: ready-for-human

## Problem Statement

An author previewing a readme in the World Editor sees their placeholders silently replaced by resolved
values, with no indication of which text came from which chip. The plain (non-markdown) Preview tints every
resolved value in its chip's own color, so the two preview panes speak different languages: the same chip is
traceable in one field and invisible in the next. The gap was a renderer limitation at the time — the
markdown renderer took a plain string, so no colored span could survive it — recorded in code as a deliberate
"untinted" decision. That limitation no longer holds.

Separately, a chip that resolves to nothing vanishes from both previews without a trace, so an author cannot
tell a placeholder that produced an empty value apart from one they forgot to insert.

## Solution

The markdown Preview tints each resolved chip value in the chip's own color, exactly matching the plain
preview's treatment, so both panes speak one language. A chip resolving to nothing leaves a small faint
marker in the chip's color — in **both** panes, for **every** chip family — so emptiness is visible instead
of silent. Values that render correctly but cannot be tinted (a value spanning markdown blocks) fall back to
untinted, silently. Player-facing surfaces are untouched.

## User Stories

1. As a world author, I want resolved placeholder values tinted in the readme's markdown Preview, so that I can see which text came from which chip.
2. As a world author, I want the markdown Preview's tint to use the same chip color and style as the plain Preview, so that both panes read as one system.
3. As a world author, I want a value containing markdown syntax to render as markdown inside its tint, so that the Preview still shows exactly what the player will see.
4. As a world author, I want a Wildcard's re-roll on each Preview open to keep working unchanged, so that I can sample different rolls with the tint applied.
5. As a world author, I want a chip that resolves to nothing to leave a faint chip-colored marker in the Preview, so that I can spot a placeholder producing an empty value.
6. As a prompt author, I want the same empty-value marker in the plain prompt Preview — including for an affixed variable whose placement vanishes — so that I can spot a chip contributing nothing to the model's payload.
7. As a world author, I want a value that spans markdown blocks to still render correctly even though it loses its tint, so that an unusual value never breaks the Preview.
8. As a world author, I want the tint to look right in both the light and dark themes, so that neither theme hides or washes out the highlight.
9. As a player, I want resolved placeholder text in-game to look like ordinary prose with no tint, so that authoring seams never show through.
10. As a world author, I want a value that happens to contain the tinting's internal marker characters to render as plain text without breaking the highlight pairing, so that no input can corrupt the Preview.
11. As a world author, I want the tinted markdown Preview to work identically in the inline field, the fullscreen editor, and the split view, so that the pane behaves the same wherever I open it.
12. As a world author, I want the Preview to keep rendering sanitized markdown with no raw HTML enabled, so that community-shared world text cannot inject markup through the tinting path.

## Implementation Decisions

- **Scope**: author-side Preview panes only. The two readme fields are the only markdown chip surfaces today;
  the mechanism must work for any future markdown field of either chip family. Player-facing rendering is
  untouched.
- **Mechanism**: resolved chip values are wrapped in sentinel characters (Unicode Private Use Area) before
  the markdown render; a rehype plugin in the markdown renderer's pipeline splits text nodes on the
  sentinels and wraps the enclosed spans in mark elements carrying the chip's color. No raw HTML is enabled
  anywhere — the sanitizer's posture is unchanged. This follows the decision that the old "a colored span
  can't survive the renderer" constraint is obsolete now that the renderer accepts rehype plugins.
- **One new module** owns the sentinel codec and the rehype plugin as its public surface; both preview panes
  and the markdown renderer consume it. Sentinel characters are stripped from author text and values
  defensively before wrapping, so no input can forge or break a pairing.
- **Tint style**: identical to the plain preview's existing chip-colored mark (same color source, same
  alpha). No new visual language.
- **Values render as markdown** inside the tint. Whatever inline content the value becomes is what gets
  wrapped; a value whose markdown splits it into several inline nodes within one block tints each part.
- **Block-spanning values bail**: a value containing a block boundary (blank line) renders correctly but
  untinted, with no notice anywhere. The plugin must degrade per-value, never fail the whole render.
- **Empty resolutions show a faint marker** in the chip's color instead of vanishing, in both the plain and
  markdown panes, for both chip families. This deliberately changes the plain prompt preview's
  exact-payload contract: an affixed variable whose placement vanishes for the model still leaves the marker
  in the preview. The existing test asserting an affixed empty chip renders as nothing at all flips to
  expect the marker — a product decision from this spec, not a test accommodation.
- **Wildcard re-roll on Preview open is unchanged**; the tint applies to whatever the current roll produced.
- The plugin is chip-family-agnostic: it carries whatever color the resolving pane hands it, so prompt
  variables and placeholders need no separate paths.

## Testing Decisions

- Good tests here assert external behavior: what the Preview pane shows for a given value and chip set —
  never the sentinel encoding, node shapes, or plugin internals.
- **Seam 1 (existing)**: the prompt field component, rendered with preview values, Preview opened by click —
  the seam the existing preview tests already use. Covers: plain-pane tint unchanged, the new empty-value
  marker in the plain pane (both an empty placeholder and an affixed empty variable), and the exact
  sentinel-wrapped string handed to the (mocked) markdown renderer.
- **Seam 2 (new, one module)**: the sentinel codec + rehype plugin, run through a real unified/remark/rehype
  parse of markdown strings — asserting tinted mark elements with the right colors, per-value bail on
  block-spanning input, marker emission for empty values, and graceful handling of stray sentinel
  characters. This tests our plugin against the real markdown parser, not the renderer component.
- The final Streamdown-rendered DOM stays out of jsdom per the repo's recorded precedent (the renderer is
  mocked in component tests); it is verified live in the preview and named as not unit-covered.
- Prior art: the existing preview resolution tests (chip-affix behavior through the component seam) and the
  headless editor-state tests for markdown transforms.
- New and changed guards get mutation-tested: reintroduce each bug (tint dropped, marker dropped, bail
  removed) and watch the right test fail.

## Out of Scope

- Player-facing tinting of resolved placeholders in-game (readme popups, entity text, narration).
- Any notice or badge when a block-spanning value bails to untinted.
- Tooltips or interactivity on tinted spans (the plain preview's marks have none either).
- Nested placeholders, weighting, or any resolution-semantics change.
- The narration Edit Text modal and World Description field (no chip vocabulary or no preview values — the
  gate that keeps them untinted is upstream of this feature).

## Further Notes

- The readme fields are the only markdown chip surfaces today, so live verification happens there
  (Introduction and Gameplay readmes, World Editor → Overview).
- The obsoleted "deliberately untinted" comment on the markdown preview pane must be replaced, not left
  contradicting the code.
- Display-only change: no world or save shape is touched, no AI-call text changes, so neither an export-shape
  reminder nor a prompt probe applies.
