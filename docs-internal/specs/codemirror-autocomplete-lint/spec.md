# Spec: Stat-Code Autocomplete + Diagnostics

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

Follow-up to `.scratch/codemirror-stat-code/spec.md` (shipped). CodeMirror 6 is already mounted in the stat-code field; this adds the two follow-ups its Out of Scope section named, which share one input: the exact sandbox surface.

## Problem Statement

Authors writing stat code must remember the sandbox's small API from memory. A typo'd variable (`elapsedHrs`, `stat` instead of `stats`) is a `ReferenceError` only discovered when the code runs; a typo'd stat name inside `stats.find(s => s.name === 'Helth')` is worse — it silently yields `undefined` and the code misbehaves without erroring. Syntax errors (unclosed bracket, stray token) are likewise invisible until the sandbox reports them. The editor now has a real parse tree sitting unused for all of this.

## Solution

Two additions to the existing stat-code CodeMirror editor, sharing one "sandbox surface" module:

1. **Autocomplete** — completions for exactly what the sandbox exposes: the injected globals (`stats`, `currentStatId`, the six clock variables, `console`), the eight fields on a stat object after a `.`, QuickJS built-ins the code can actually use (`Math`, `JSON`, `Number`, etc.), and — the high-value one — the world's real stat names as string-literal completions inside quotes.
2. **Diagnostics** — inline squiggles + gutter markers for: syntax errors (from the Lezer tree already in the editor), references to identifiers that don't exist in the sandbox, and a missing top-level `return` warning.

## User Stories

1. As a world author, I want typing to offer the sandbox's variables (`stats`, `elapsedHours`, `daypart`, …), so that I don't have to memorize the API or open the help text.
2. As a world author, I want `.` after a stat object to offer its eight fields, so that I never typo `regen` or reach for a field that doesn't exist.
3. As a world author, I want a string literal in my code to offer my world's actual stat names, so that `stats.find(s => s.name === '…')` can't silently miss.
4. As a world author, I want each completion to show a one-line description (what the variable means, a field's type), so that the list teaches the API as I use it.
5. As a world author, I want an unclosed bracket or invalid syntax underlined as I type, so that I fix it before running the code.
6. As a world author, I want a reference to a variable the sandbox doesn't provide flagged, so that a typo is a red underline instead of a runtime ReferenceError.
7. As a world author, I want a warning when my code can never `return` a number, so that "code ran but nothing happened" has a visible cause.
8. As a world author, I want variables and functions I declare myself recognized, so that my own `const hunger = …` is neither flagged nor missing from completions.
9. As a keyboard-only user, I want the completion popup dismissible with Escape without losing the Escape-then-Tab focus escape hatch, so that the editor still doesn't trap me.
10. As a template author, I want `{{slot}}` regions excluded from diagnostics, so that template code isn't covered in false errors for syntax that's valid after fill-in.
11. As a mobile author, I want the completion popup usable with the on-screen keyboard (tap to accept), so that the feature isn't desktop-only.
12. As a player who never opens the World Editor, I want none of this in the gameplay bundle, so that loads stay lean.

## Implementation Decisions

- **Packages:** `@codemirror/autocomplete` and `@codemirror/lint` (versions verified live at implementation time via `npm view`), loaded inside the existing lazy editor chunk — gameplay never fetches them.
- **One sandbox-surface module** (`src/lib/statCodeSurface.ts` or similar) is the single source of truth: the global names + descriptions, the stat-object field list + descriptions, and the allowed built-ins. It imports `STAT_CLOCK_VARS` from the executor rather than restating it, and the executor/help-text stay the consumers they are today. **This module describes the surface; it never widens it** — the QuickJS exposure is untouched (hard rule).
- **Completions:**
  - Scope-aware globals: sandbox globals + built-ins, merged with identifiers the author declared in their own code (walk the Lezer tree for declarations in scope).
  - Member completions after `.` only when the object is recognizably a stat (result of `stats.find/…` or an identifier assigned from one); when unknown, offer the stat fields anyway at lower rank rather than guessing wrong.
  - String-literal completions: inside quotes, offer the world's stat names. The stat list flows in as a prop on the code field (the editor panel already has it; the template dialog passes the same world's stats).
  - No network, no async sources; everything synchronous from props + tree.
- **Diagnostics (linter callback on the existing parse tree):**
  - Syntax errors: Lezer error nodes → error severity.
  - Unknown identifiers: free variables not in (sandbox surface ∪ author declarations ∪ standard JS globals whitelist) → error severity, message names the identifier and suggests the nearest surface name when the edit distance is small.
  - Missing `return`: no `return` statement anywhere in the code → warning severity (the executor treats a non-number as an error today; this predicts it).
  - Debounced by `@codemirror/lint`'s own delay; no diagnostics work while typing mid-word.
- **Template slots:** the slot decorator already knows slot ranges; both the completion source and the linter treat slot regions as opaque — no diagnostics inside or spanning them, and a slot placeholder identifier is never "unknown". In the template *editor*, `{{` also completes the defined slot names.
- **Fullscreen/inline shared state:** both extensions live in the shared `EditorState`, so behavior is identical in both views and survives the fullscreen toggle for free.
- **Theme:** popup and squiggle styles themed on the app's design tokens, both themes, matching the highlight-style approach already shipped.
- **The Test button stays the ground truth.** Diagnostics are advisory; nothing blocks saving or running code with warnings.

## Testing Decisions

- Behavior-only assertions, same bar as the parent spec: what completions appear for a given doc+cursor, what diagnostics a given code string produces — never CM internals.
- **Seam 1 — the sandbox-surface module + lint source as pure units:** code string in, diagnostics out (syntax error positions, unknown-identifier names, missing-return). New test file beside the module. Cases: clean code, each error class, author-declared variables not flagged, slot regions skipped, near-miss suggestion (`elapsedHrs` → `elapsedHours`).
- **Seam 2 — the completion source as a pure function** of (doc, cursor, stat names): globals offered at top level, fields after `.`, stat names inside quotes, author declarations included.
- **Seam 3 — CodeArea component tests** extended minimally: popup appears and a completion applies via the RTL harness; Escape closes the popup without breaking the Escape-then-Tab escape (regression on story 5 of the parent spec).
- **Drift guard:** a test asserting the surface module's global list matches what `executeStatCode` actually injects (build the same program prelude names) — so a future executor change can't silently desync the completions.
- Live-preview verification (both themes, mobile viewport) for popup styling and touch acceptance, per the static-frame evidence rule.
- Suites that must stay green: CodeArea, fullscreen shell, stat manager flows, template dialog, statCodeExecutor.

## Out of Scope

- **Widening the sandbox** — no new variables, no new built-ins exposed to QuickJS.
- **Type-level analysis** — no inference beyond "is this a stat object"; no TS language service.
- **Other text fields** (prompts, notes) — stat-code surfaces only.
- **Blocking saves on diagnostics** — advisory only.
- **Export shape** — no world/save JSON changes.

## Further Notes

- Sandbox surface verified live from `src/lib/statCodeExecutor.ts` at spec time: globals are `stats` (array of `{id,name,type,description,min,max,value,regen}`), `currentStatId`, the six `STAT_CLOCK_VARS`, and a `console.log` shim; user code runs as a function body, hence `return`.
- `usesStatClock`'s regex scan means completing a clock variable into a comment would make the stat tick every turn — pre-existing, documented as harmless in the executor, not this spec's problem.
- Bundle delta expected small (autocomplete ~30KB min, lint ~10KB min) and entirely inside the lazy chunk; measure at implementation time.
