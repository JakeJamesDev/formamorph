# Spec: CodeMirror Syntax Highlighting for Stat Code

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

Authors writing stat code in the World Editor edit JavaScript in a plain monospace textarea. There is no syntax highlighting, no bracket matching, and no indentation support, so mistakes that a real code editor would surface visually (unclosed brackets, typos in keywords, string boundaries) go unnoticed until the code is run in the sandbox. Template preview panes show generated code as uncolored text, making the slot fill-ins hard to distinguish from the surrounding code.

## Solution

Replace the code field's textarea with a CodeMirror 6 editor: JavaScript syntax highlighting themed on the app's own design tokens (both themes), bracket matching, auto-indent, Tab indentation, and line wrapping — while keeping every affordance the field has today (toolbar undo/redo, variable/slot insert menus, the fullscreen morph, edit/preview split, mobile behavior). Read-only preview surfaces get the same highlighting via a lightweight helper that colors code without mounting an editor. Template slot syntax (`{{name:type=default}}`) is decorated distinctly in both surfaces.

## User Stories

1. As a world author, I want the stat code field to color JavaScript syntax, so that I can read and scan my code the way I would in a real editor.
2. As a world author, I want string, number, keyword, comment, and identifier tokens visually distinct, so that typos and unclosed strings are visible before I run the code.
3. As a world author, I want matching brackets highlighted, so that I can see unbalanced parentheses at a glance.
4. As a world author, I want pressing Tab to indent (and Shift-Tab to dedent), so that I can structure code without typing spaces by hand.
5. As a keyboard-only user, I want an escape hatch from Tab capture (Escape then Tab), so that the editor doesn't trap my focus.
6. As a world author, I want new lines to auto-indent to match the enclosing block, so that structure comes for free.
7. As a world author, I want long lines to wrap, so that I never scroll horizontally in a narrow field.
8. As a world author, I want the toolbar Undo/Redo buttons to keep working (including on mobile where there is no Ctrl+Z), so that I can step back through edits.
9. As a world author, I want undo history to survive entering and leaving fullscreen, so that fullscreen is just a bigger window on the same editing session.
10. As a world author, I want the Variable and Slot insert menus to keep working, inserting at the caret and selecting the placeholder portion, so that snippet insertion behaves as it does today.
11. As a world author, I want a template insert (from the Templates dialog) to be a single undo step, so that one Ctrl+Z removes it.
12. As a world author, I want the fullscreen editor to show line numbers, so that I can locate the line a sandbox error reports.
13. As a world author, I want the inline field to stay compact without a gutter, so that narrow panels keep their width for code.
14. As a world author using the light theme, I want highlight colors that fit the light palette, so that code is legible without switching themes.
15. As a world author using the dark theme, I want highlight colors that fit the dark palette, so that the editor matches the rest of the app.
16. As a template author, I want `{{slot}}` tokens decorated distinctly in the template code editor, so that the fill-in points stand out from real JavaScript.
17. As a template user, I want the picker's code preview highlighted, including the values filled into slots, so that I can read what will be inserted.
18. As a template author, I want the Preview tab of the template editor highlighted the same way as the picker, so that I see exactly what users will see.
19. As a mobile author, I want the editor to work with the on-screen keyboard and the height-pinned pane, so that the field stays usable when the keyboard eats the viewport.
20. As a player who never opens the World Editor, I want none of the editor's bundle cost, so that gameplay loads stay lean.
21. As a world author on a slow connection, I want a usable plain fallback while the editor loads, so that the field is never blank or dead.
22. As a world author, I want the fullscreen morph animation to keep working (growing out of the field and returning to it), so that the editor feels like the same unified surface as every other fullscreen field.
23. As a world author with reduced motion enabled, I want the morph to stay suppressed, so that the accessibility behavior is unchanged.
24. As a world author, I want the Edit | Preview tabs and the side-by-side split in fullscreen to keep working, so that testing code against its preview is unchanged.
25. As a screen-reader user, I want the editor to keep an accessible label, so that the field announces itself as it does today.

## Implementation Decisions

- **CodeMirror 6** (current major; the `codemirror` meta-package's `latest` tag is 6.x — there is no 7). Install the scoped packages (`state`, `view`, `language`, `commands`, `lang-javascript`) directly.
- **No React wrapper library.** A thin owned binding (~40 lines) mounts the `EditorView`, syncs the controlled value with the parent (parent stays the single owner of the text), and exposes the editor's DOM element for the fullscreen morph measurement. `@uiw/react-codemirror` was considered and rejected: its value-sync layer sits between us and the morph/insert plumbing.
- **History moves into CodeMirror.** The component's hand-rolled history (word-at-a-time undo folding, caret restore effect) is deleted; the shared text-history module remains for its other consumer. Toolbar Undo/Redo wire to CM's history commands, with depth queries driving disabled state.
- **One editor state shared across the inline and fullscreen copies**, so undo history survives the fullscreen toggle (reparent the view or hand its state across). Two independent views resetting history on toggle was rejected as a behavior regression.
- **Snippet insertion** becomes a CM transaction (changes + selection), preserving today's contract: insert at caret, select the `select` portion of the snippet, one undo step never folded into surrounding typing.
- **Read-only previews use a pure highlight helper** built on the Lezer JavaScript parser and highlighter — code string in, colored spans out — dropped into the existing preview markup. No editor instances in previews.
- **Slot decoration:** template slot syntax gets a distinct style in both surfaces — a CM decoration in the editor, a matching span in the highlight helper — reusing the existing slot parser rather than a second grammar.
- **Theme:** a custom highlight style built on the app's Tailwind design tokens so both themes are covered automatically. Stock themes rejected (single fixed look).
- **Editor options:** line wrapping on; Tab indents via the standard `indentWithTab` recipe; line-number gutter in fullscreen only; bracket matching and auto-indent from the language package.
- **Lazy loading:** CodeMirror loads behind the code field (dynamic import); the fallback during load is the existing plain textarea so the field is never empty. Gameplay-only sessions never fetch the editor chunk (~65KB gzip).
- **Fullscreen morph:** the morph hook's source ref type widens from textarea to a generic element so it can measure the editor's root. FLIP behavior, reduced-motion suppression, and the shell are otherwise untouched.
- **Sizing:** the editor replaces the textarea's row/min-height contract with equivalent CM theme config (fixed-height inline, flex-grown fullscreen, internal scrolling) — the mobile keyboard height-pinned-pane behavior must be preserved.
- **Autocomplete is a follow-up**, not part of this change (see Out of Scope).

## Testing Decisions

- **Good tests here assert external behavior only**: text in the field, what `onChange` receives, button disabled states, selection after an insert — never CM internals, decoration class names as implementation detail, or animation timing.
- **Seam 1 — the existing CodeArea component tests** (React Testing Library), extended to drive the CM editor: typing propagates to `onChange`, undo/redo buttons step history and disable at the ends, insert menus place snippets at the caret with the documented selection, fullscreen toggle preserves history. jsdom needs a couple of small CM shims (measure/geometry stubs); these live with the existing test setup.
- **Seam 2 — the highlight helper as a pure unit**: code string in, token spans out; covers JS token classes and slot decoration for both preview surfaces. New test file beside the helper.
- **Prior art:** the existing CodeArea component tests (toolbar, history, fullscreen) and the fullscreen shell tests; the pure-module style follows the text-history and stat-code-template unit tests.
- Theme colors, morph animation, and sizing are verified in the live preview (both themes, mobile viewport), not unit tests — per the project's static-frame evidence rule.
- Existing suites that must stay green: CodeArea, fullscreen shell, stat manager flows, template dialog.

## Out of Scope

- **Autocomplete** against the sandbox surface (stats, clock variables) — natural follow-up once CM is in.
- **Linting/diagnostics** (surfacing syntax errors inline before the sandbox runs) — also a follow-up; the parse tree makes it cheap later.
- **Other text fields** (prompt editors, notes, world text) — this change touches only the stat-code surfaces.
- **Sandbox changes** — the QuickJS executor, its exposed variables, and stat-code semantics are untouched.
- **Export shape** — no world/save JSON changes of any kind.

## Further Notes

- The two consumers of the code field are the stat editor panel and the stat-code template dialog (editor + picker); the preview surfaces are the dialog's preview pane and the template form's generated-code block.
- Bundle cost measured at ~200KB min / ~65KB gzip for the five packages; acceptable given lazy loading.
- Version facts verified live via npm at spec time: `@codemirror/state` 6.7.1, `view` 6.43.8, `language` 6.12.4, `commands` 6.10.4, `lang-javascript` 6.2.5.
