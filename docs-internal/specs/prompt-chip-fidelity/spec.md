# Spec: The Language Chip, and Chip Fidelity

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

Two related problems, both about the prompt an author writes not being the prompt the model receives.

First, the AI Language directive is invisible and immovable: it is appended by code at a fixed position (last), never appears in the prompt chip editor, and an author who knows their model better has no way to place it elsewhere. Players auditing the AI Context viewer see a line their prompt never mentions.

Second, the prompt builders silently re-insert content whose chip the author deleted: a prompt without a notes chip gets a notes section inserted before the location header, and a prompt without an after-dictionary chip gets activated lore appended at the end. A power user who removed a chip meant to remove it — re-adding the content at a surprise position is plain bad UX, and it means custom prompts never truly adhere to what was written.

## Solution

Make the prompt template the single source of truth: what you wrote is what renders. A new language chip joins the existing chip family, resolving to the imperative language directive (or to nothing when the language counts as English). Every template-absent fallback is removed — no chip, no injection, for notes, lore, and language alike. The default templates gain the language chip in last position, so default-prompt users keep byte-identical behavior; authors who deviate own their deviation.

## User Stories

1. As a world author, I want a language chip I can place anywhere in my narration prompt, so that the directive sits where my model obeys it best.
2. As a world author, I want the same chip available in the choices prompt, so that both player-facing surfaces are steerable the same way.
3. As a world author, I want deleting a chip to actually delete its content from the rendered prompt, so that my prompt adheres to what I wrote.
4. As a world author, I want no hidden appends of any kind, so that reading my template tells me the whole prompt.
5. As a power user, I want the removal of the notes fallback, so that deleting the notes chip stops notes from being injected at a surprise position.
6. As a power user, I want the removal of the lore fallback append, so that deleting the dictionary chips genuinely stops lore injection.
7. As a player using the default prompts, I want rendered output identical to today's, so that this change is invisible to me.
8. As a player with a non-English language set, I want the default templates to still deliver the directive as the final line, so that the recently-shipped fix keeps working.
9. As a player with English (or a blank value) set, I want the language chip to resolve to nothing, so that my prompt carries no stray directive or dangling blank lines.
10. As a player auditing the AI Context viewer, I want every line of the system prompt traceable to my template and its chips, so that nothing in the payload is unexplained.
11. As an author of a community world with custom prompts, I want the chip palette to show me the language chip, so that I can adopt it deliberately.
12. As an author of a non-English world, I want the stat-updates pass to work with my authored stat names instead of being told to write English, so that stat tracking works in my world's language.
13. As a developer, I want one chip-resolution path with no fallback branches, so that prompt assembly is simpler to reason about and test.
14. As a developer, I want the language directive's wording defined in exactly one place shared by chip and default, so that chip output can never drift from the shipped directive.

## Implementation Decisions

- A language chip joins the chip registry for the narration and choices prompt surfaces (both the preset editor and the per-world prompt overrides, which share the chip editor).
- The chip resolves through the shared English-normalization helper: a non-English value renders the imperative directive ("Write all narration in X." for narration, "Write all choices in X." for choices); English, blank, or whitespace renders an empty string.
- The code-side final append of the language directive is removed from both builders; the chip is the only delivery path.
- The notes fallback (inserting a notes section when the template lacks the notes chip) is removed.
- The lore fallback (appending activated dictionary lore when the template lacks the after-dictionary chip) is removed.
- Dictionary position routing is kept: when a template carries only one dictionary chip, entries positioned for the missing one still flow to the chip the author kept. Entry position is world data, not prompt authorship — the author's placement decision is respected, and content only vanishes when the author removed every dictionary chip.
- The stat-updates English rider is deleted entirely: the builder appends nothing for any language, and the language parameter leaves its signature. The real parsing contract — echo each stat's exact name from the list — already lives in the default stat-updates template and is language-neutral by construction (the list carries the authored names, whatever language the world is written in). The rider was redundant for English worlds and actively harmful for non-English ones, inviting translation of the very names the parser must match.
- Both default templates (narration and choices) gain the language chip in last position, preserving the recency placement the language fix shipped with.
- The rendered prompt is trimmed of trailing whitespace after chip resolution, so an empty-resolving trailing chip leaves no dangling blank lines and the English default renders byte-identical to today.
- Hard cutover, decided explicitly: no seeding, no migration, no notice. Custom presets and community-world prompt overrides authored before a chip existed lose that injection until their author adds the chip. This is the accepted cost of prompt fidelity.
- No export-shape change: world prompt overrides keep their existing fields; only rendering behavior changes.

## Testing Decisions

- Tests assert only external behavior — the rendered prompt string from the pure builders — never internal helper calls.
- The two existing prompt-builder seams are reused, with no new seams: the narration prompt builder's unit tests and the turn-pass builder harness. The chip registry addition relies on existing editor coverage; no component-level chip-editor tests.
- New assertions: the chip renders the directive at the author's chosen position (start, middle, end); a template without the chip gets no directive anywhere, whatever the language setting; English/blank/whitespace resolve the chip to nothing with no residual blank lines; templates without notes or dictionary chips get no fallback insertion or append; single-dictionary-chip routing still delivers both entry positions; the stat-updates builder appends nothing for any language value.
- A byte-identity fixture: the updated default narration and choices templates render exactly today's output for both the English and non-English cases. Prior art exists — the narration builder already has a fixed-input byte-identical prompt test. Byte-identity for defaults is what makes a probe run unnecessary for those two surfaces: the wording and default placement are unchanged, so there is no prompt-text behavior to re-measure.
- The stat-updates rider deletion is NOT byte-identical for the non-English arm (the "Please write in english" line disappears), so it ships with probe evidence per the prompt-writing guide: a non-English-setting arm on both tiers, stat-parse success rate as the metric, with the usual other-metric regression check.

## Out of Scope

- Chips for the other code-side riders (markdown guidance, length guidance) — those remain settings-driven appends.
- Strengthening the stat-updates template's exact-name wording (e.g. "never translated") — a separate prompt-text change with its own probe if reports show translation drift.
- Any seeding, migration, or one-time notices for existing custom prompts or community worlds.
- Language coverage for other AI surfaces (memories, diaries, entities, staged passes) — unchanged from the previous spec's scoping.
- UI changes beyond the chip appearing in the existing chip palette.

## Further Notes

- Blast radius, stated for the record: community worlds ship prompt overrides inside the world export, so the cutover affects downloaded worlds as well as the user's own presets. Their prompts render exactly as authored — which is the point — but authors of pre-chip custom prompts must re-add chips to regain injections.
- The language directive fix (imperative wording, shared English normalization) is already implemented in the tree by a parallel session; this spec builds on it and must not regress its tests — the final-append removal replaces the mechanism, the default-template chip preserves the behavior.
