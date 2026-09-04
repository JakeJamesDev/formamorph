# Spec: Stat Code Editor Polish — VS Code Keys and Honest Completions

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

Authors writing stat code expect the editor to behave like the editor they already know — VS Code. Today it doesn't, in four ways:

1. Tab never accepts the highlighted completion; it indents instead. Every mainstream editor accepts on Tab.
2. Tab always indents the whole line, even with the caret mid-line, and a single-line selection indents the line instead of being replaced. Neither matches muscle memory.
3. The completion popup cannot be scrolled with the mouse wheel — long lists are keyboard-only.
4. Typing `.` after *anything* offers the eight stat fields (`id`, `name`, `regen`, …), even after `Math.` or `JSON.`, which reads as the editor being wrong rather than helpful. This directly fed a community misunderstanding about what `.regen` returns.

## Solution

Make the stat code editor's keyboard and popup behavior match VS Code where the sandbox has an equivalent, and make dot-completions honest: offer the real members of the known builtins, offer array members after `stats`, offer stat fields only where the expression plausibly is a stat, and offer nothing where the editor cannot know.

## User Stories

1. As a world author, I want Tab to accept the highlighted completion while the popup is open, so that the editor matches my VS Code muscle memory.
2. As a world author, I want Enter to keep accepting completions too, so that existing habits keep working.
3. As a world author, I want Tab with the caret mid-line to insert an indent at the caret, so that pressing Tab doesn't yank the whole line sideways.
4. As a world author, I want Tab on a selection inside one line to replace the selection with an indent, so that Tab behaves like typing, as in VS Code.
5. As a world author, I want Tab on a multi-line selection to indent all the selected lines, so that block-indenting works the way I expect.
6. As a world author, I want Shift+Tab to unindent the line or selected lines, so that outdenting mirrors indenting.
7. As a world author, I want Tab on a blank line to indent it to a sensible depth, so that starting a nested line costs one keypress.
8. As a keyboard-only author, I want Escape-then-Tab to still move focus out of the editor, so that the new Tab meanings don't trap me in the field.
9. As a world author, I want to scroll the completion popup with my mouse wheel, so that long completion lists aren't keyboard-only.
10. As a mobile author, I want to scroll the completion popup by touch, so that the popup works on the small screen at all.
11. As a world author, I want `Math.` to offer Math's actual members (min, max, round, floor, abs, random, …), so that completions after a builtin are real.
12. As a world author, I want `JSON.`, `Object.`, `Number.`, `Array.`, `String.`, `Boolean.` and `Date.` to offer their actual static members, so that no builtin ever offers stat fields.
13. As a world author, I want `stats.` to offer array members (find, filter, map, length, …), so that the most common expression in stat code completes correctly.
14. As a world author, I want stat fields offered after a stat-shaped expression (a `stats.find(...)` result or a variable assigned from one), so that the useful case keeps working exactly as today.
15. As a world author, I want no completions after an expression the editor cannot type, so that silence replaces wrong suggestions.
16. As a world author, I want each builtin member completion to carry a short description, so that the info panel teaches me the sandbox as I type.
17. As a world author, I want the completion popup to keep working identically in the full-screen editor overlay, so that behavior doesn't change with the view.
18. As a player of community worlds, I want authors to have an editor that doesn't mislead them about the sandbox, so that worlds ship with working stat code.

## Implementation Decisions

- All changes live in the stat code editing stack: the code session (editor wiring, keymaps, popup host), the stat-code analysis module (completion logic), and the stat-code surface module (declarative data about what the sandbox exposes). No sandbox executor changes — this is editor UX only; nothing about what stat code can *do* changes.
- **Tab accept**: bind Tab to CodeMirror's `acceptCompletion` at a precedence above the indent binding. `acceptCompletion` returns false with no popup open, falling through to indent — no state flag needed.
- **Tab indent semantics** replicate VS Code's `TabOperation` (verified against the vscode source, main branch, Aug 2026):
  - Empty selection, whitespace-only line → indent the line (CodeMirror's syntax-aware line indent is the approximation of VS Code's "good indent"; full language-config indent is out of scope).
  - Empty selection otherwise → insert one indent unit at the caret.
  - Single-line selection that isn't the whole line → replace the selection with one indent unit.
  - Multi-line selection, or a whole-line selection → indent the selected lines.
  - Shift+Tab → unindent lines (current behavior, kept).
  - The editor's indent unit stays two spaces; no literal tabs are ever inserted (VS Code's insertSpaces mode).
- **Escape-then-Tab focus escape stays.** It is the sandbox's substitute for VS Code's "Tab Moves Focus", and completion-Escape (close popup) continues to win over it by keymap precedence.
- **Wheel scroll**: the popup's body-mounted tooltip host already stops `pointerdown` propagation to survive dialog click-away; extend the same guard to `wheel` and `touchmove`. Root cause (verified in react-remove-scroll source): the dialog scroll lock preventDefaults wheel events whose target is outside the dialog subtree, via a bubble-phase document listener — stopping propagation at the host defeats it. No Radix or scroll-lock configuration changes.
- **Dot-completion honesty**, in the analysis module, decided in this order:
  1. Expression before the dot is a known object-shaped builtin (`Math`, `JSON`, `Object`, `Number`, `Array`, `String`, `Boolean`, `Date`) → offer its static members from a new declarative table in the surface module (name, detail, one-line info each). Members list what QuickJS actually provides, hand-curated to what stat code plausibly reaches for.
  2. Expression is `stats` (bare) → offer array members (find, filter, map, some, every, reduce, length, at — curated, not the whole Array prototype).
  3. Expression looks like a stat (existing heuristic: `stats.find(...)`-shaped chain or a variable assigned from one) → offer the eight stat fields, as today.
  4. Anything else → offer nothing. Silence over wrong.
- The existing rank-boost mechanism (+1/−1) becomes unnecessary for stat fields and is removed with the fallback it served.
- The surface module remains purely descriptive; the drift guard between surface and executor is untouched because no new names enter the sandbox.
- The typo-suggestion helper (`nearestSurfaceName`) picks up the new member names only if trivially cheap; otherwise unchanged.

## Testing Decisions

- Good tests here assert **external editor behavior** — what a keystroke or wheel event does to the document, selection, or popup — never keymap internals or listener wiring.
- **Completion content**: pure tests against the analysis module's completion function (document text + cursor position in, option list out), extending its existing test file. Cases: each builtin offers its members and never stat fields; `stats.` offers array members; stat-shaped expressions still offer the eight fields; unknown objects offer nothing; the info text present on member entries.
- **Keyboard and wheel behavior**: through the existing CodeArea jsdom harness, which drives the real CodeMirror editor with userEvent keystrokes — the established prior art for this component. Cases: Tab accepts when the popup is open and the document gains the completion; Tab mid-line inserts an indent at the caret only; Tab on a single-line partial selection replaces it; Tab on a multi-line selection indents both lines; Shift+Tab unindents; Escape-then-Tab still leaves the field; a wheel event over the popup host does not reach the document (the scroll-lock guard).
- Per the test bar: each new guard must fail when its behavior is reverted (reinstate `indentMore`-always and watch the mid-line test fail), and no test may avoid the popup by disabling completions.
- Live verification in the World Editor (dev-router to a stat's code field) for wheel scrolling and popup placement, since jsdom cannot measure CodeMirror tooltip layout.

## Out of Scope

- Real type inference or a TypeScript language service — instance members (`s.name.` → string methods), chained results (`stats.filter(...).`), and author-declared objects stay silent by design.
- VS Code's language-configuration "good indent" (indentation rules, onEnter rules); CodeMirror's syntax indent is the stand-in.
- Shift+Tab / Shift+Enter "accept and replace" suggestion modes (the sandbox has no replace mode).
- VS Code's `tabCompletion` (Tab triggering suggestions when the popup is hidden) — off by default in VS Code too.
- Ctrl+M "Tab Moves Focus" toggle — Escape-then-Tab already fills that role.
- Any change to what the sandbox exposes, the executor, or stat-code semantics.
- The template editor's slot completions (`{{…}}`) — untouched.

## Further Notes

- The popup's clipped info panel (the `overflow: hidden` that erased the description card) was already fixed in the session that produced this spec and ships separately.
- The static-member tables double as documentation: their info strings surface in the (now visible) info panel, which is where "regen is the effective, trait-adjusted value" style clarifications can live later.
- VS Code behavior was verified from the vscode repository sources (TabOperation in the cursor type-edit operations; the suggest controller's keybindings), not from memory.
