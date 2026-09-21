# Spec: Prompt Chip Headers

Status: ready-for-agent
Status note: Product design confirmed; use existing production rendering, editing, and sharing boundaries for verification.
Spec session: 01a0c120-20d3-73b3-b469-3c0269c75b6b

## Problem Statement

A prompt author currently uses Prepend and Append to give a chip a conditional section heading. This is powerful, but requires the author to manage heading syntax, capitalization, spacing, and XML closing tags. Those literal affixes do not automatically follow a chip's Format selection.

Built-in presets derive their styles from canonical Markdown, but that conversion must recognize headings hidden inside affixes and keep surrounding XML sections balanced. Recent fixes exposed how easily that implicit structure can drift. Authors need a straightforward way to label a section while retaining affixes for custom wording.

## Solution

Add an optional **Header** field to every prompt chip. The author enters a single line of raw heading text. The chip's **Format** controls the generated heading and, where supported, the body. Store the heading once rather than rewriting it when Format changes.

| Format | Header presentation for “player character” |
| --- | --- |
| Markdown | A level-two heading reading “Player Character” |
| Simple | An uppercase label reading “PLAYER CHARACTER:” |
| XML | A lowercase opening tag named “player_character” and its matching closing tag around the section |

A headed placement becomes a separate section. Its content order is heading/opening tag, Prepend, value, Append, then the XML closing tag when applicable. The whole generated section disappears when the value is empty or N/A.

### Editing contract

- Place Header above Prepend/Append in the existing chip options. Leave Header empty unless the author wants a section.
- Use the chip's Format, not the preset's section style. Existing format-capable chips retain their selection.
- A chip without body formatting gains a Format selector when Header is filled. Its initial selection is **Simple**; its body remains unchanged.
- **Name** remains plain text. Format stays available when Header needs it, including for Name.
- Show generated headings and closing tags through the existing conditional highlight. Selecting either opens the chip's options.
- Clearing Header removes generated structure, retains Prepend/Append, and remembers Format. Chips without body formatting hide the selector until Header is used again.
- Whitespace-only Header means no Header. Read-only presets expose the same presentation through disabled options.

### Casing contract

Markdown uses title case, with connecting words lowercase. Preserve acronyms in mixed-case input and intentionally mixed-case names. Normalize fully uppercase phrases.

| Raw Header | Markdown heading text |
| --- | --- |
| player character | Player Character |
| PLAYER CHARACTER | Player Character |
| notes for the player | Notes for the Player |
| NPC notes | NPC Notes |
| iPhone status | iPhone Status |

Simple uses uppercase label text. XML derives lowercase tag names. Format switching preserves the original Header input.

### Section boundaries

- Supply one blank line between a headed section and adjacent content when needed.
- Reuse existing authored line breaks rather than adding duplicate spacing.
- Preserve additional blank lines the author wrote.
- Empty sections contribute no generated heading, wrappers, affixes, or spacing; surrounding authored text remains intact.
- In custom prompts, XML Header wraps only its chip and affixes. It does not close or repair surrounding XML authored by the user.
- Built-in conversion owns its surrounding section boundaries and must not nest peer sections accidentally.

## User Stories

1. As a prompt author, I want a Header field on every prompt chip, so that I can label a section without writing formatting syntax.
2. As a prompt author, I want Header to be optional, so that ordinary inline chips remain easy to use.
3. As a prompt author, I want to enter the heading once, so that changing Format does not require editing several strings.
4. As a prompt author, I want a Markdown Header to use the standard heading level, so that sections match the surrounding built-in prompt structure.
5. As a prompt author, I want Simple headers to become uppercase labels, so that I do not have to maintain their casing.
6. As a prompt author, I want XML headers to include matching closing tags, so that a section cannot be left open by forgetting its suffix.
7. As a prompt author, I want ordinary heading text converted to title case, so that lowercase input produces a consistent Markdown heading.
8. As a prompt author, I want connecting words to remain lowercase in title case, so that headings read naturally.
9. As a prompt author, I want acronyms in mixed-case input and names such as iPhone preserved, so that automatic casing does not damage intentional spelling.
10. As a prompt author, I want fully uppercase phrases normalized, so that PLAYER CHARACTER and player character produce the same Markdown heading.
11. As a prompt author, I want Header to follow the chip's Format, so that its presentation does not depend on an unrelated preset setting.
12. As a prompt author, I want chips such as Notes and World to offer Header formatting, so that I can create sections even when their bodies have no formatting options.
13. As a prompt author, I want those newly exposed Format selectors to start at Simple, so that their initial behavior is predictable.
14. As a prompt author, I want a Name value to stay inline plain text even under a formatted Header, so that formatting does not add tags or bullets to the name itself.
15. As a prompt author, I want Format available for Name when Header is present, so that I can still style the heading.
16. As a prompt author, I want Prepend and Append to remain available inside the section, so that custom connective wording remains possible.
17. As a prompt author, I want a headed chip inserted mid-paragraph to form its own section, so that I do not have to repair its line breaks manually.
18. As a prompt author, I want generated spacing to reuse existing line breaks, so that adding Header does not create unwanted empty lines.
19. As a prompt author, I want additional authored blank lines preserved, so that deliberate spacing remains under my control.
20. As a prompt author, I want the whole section omitted when its value is empty or N/A, so that the prompt does not contain empty headings or dangling wrappers.
21. As a prompt author, I want generated headings highlighted as conditional content, so that I can distinguish them from freely editable ordinary text.
22. As a prompt author, I want selecting the heading or closing tag to open chip options, so that I can edit the section from where it appears.
23. As a prompt author, I want clearing Header to retain my affixes and format choice, so that removing a heading does not destroy other customization.
24. As a prompt author, I want Header and its format preserved when moving or copying a chip, so that the section travels with its value.
25. As a prompt author, I want undo and redo to restore Header edits and moves, so that I can experiment safely.
26. As a prompt author, I want Preview and gameplay to render the same Header structure, so that Preview accurately describes the prompt sent to the AI.
27. As a world author, I want the same Header behavior in custom prompt fields, so that editing a world's prompt does not require another set of rules.
28. As a mobile author, I want Header usable through the existing full-screen editor and chip options, so that the feature is not limited to desktop.
29. As a user inspecting a built-in preset, I want Header visible but protected from editing, so that read-only behavior remains clear.
30. As a user of built-in prompts, I want single-chip sections to use Header consistently, so that the formats cannot drift through separately maintained affixes.
31. As an existing custom-prompt author, I want my stored prompt left untouched, so that introducing Header does not reinterpret my wording or nesting.
32. As an author sharing a prompt, I want Header to remain editable after export and import, so that sharing retains structure rather than flattening it.
33. As an author writing custom XML, I want Header to preserve surrounding authored nesting, so that a chip can deliberately sit inside a larger block.
34. As a maintainer, I want one shared Header renderer and common editor behavior, so that fixes reach Preview, gameplay, and every prompt-editing surface.

## Implementation Decisions

- **Header is placement data.** Extend the existing prompt-token representation so Header travels with the token. Do not store headings in a separate lookup table or overwrite Prepend/Append with generated text.
- **Keep one source of truth.** Preserve raw Header text and the selected format. Derive display text and XML wrappers at rendering time; repeated format switches must not progressively change spelling or spacing.
- **Extend shared modules.** Update the prompt token grammar and serializer, prompt vocabulary, shared template renderer, styled built-in generation, and shared chip editor presentation. Keep Header behavior out of individual screen implementations.
- **Use the common output boundary.** Preview and gameplay use the same Header semantics. Prompt assembly and request-anatomy runs must remain consistent with the rendered text and its conditional chip ownership.
- **Separate formatting capabilities from selection.** Chips with existing body formats continue to use them. On other chips, the exposed Format choice affects Header only. Do not invent formatted body variants for Notes, World, or other raw-text values.
- **Respect Name behavior.** Persona, Location, and Entities still render Name as plain text. Their Format control is ineffective only when neither the body nor a Header uses it.
- **Retain format through clearing.** Removing Header does not reset its selected format. A chip without body formatting hides Format while Header is absent and restores the remembered selection when Header returns.
- **Keep affixes literal.** Place existing Prepend and Append inside the generated section without rewriting their content. The renderer owns generated structure and boundary spacing, not author-supplied affix wording.
- **Use the existing empty-value contract.** Apply conditional omission to headed chips even when both affixes are empty. Do not confuse an unresolved token with a known empty value or change unheaded chips' existing fallback behavior.
- **Make spacing contextual.** A headed chip is a section even inside surrounding prose. Account for adjacent authored line breaks and neighboring headed chips; do not blindly concatenate fixed newline prefixes and suffixes.
- **Use one standard level.** Markdown Header uses level two. There is no hierarchy control. XML tags enclose only the placement; custom authored XML is not repaired or reparented.
- **Own built-in conversion explicitly.** Convert sections consisting of one chip throughout the built-in prompts. Keep prose sections such as Guidelines as authored text. Remove the superseded built-in heading syntax and heading-only affix fragments rather than emitting duplicate headings.
- **Keep built-in peer sections balanced.** Moving the heading into chip metadata must still close preceding peer sections correctly during built-in XML conversion. Persona must not become a child of Traits merely because its heading is conditional.
- **Preserve existing custom prompts.** Do not infer Header from stored affixes or ordinary text. Existing literal headings and custom XML retain their current behavior until the author explicitly adopts Header.
- **Preserve complete placements.** Format changes, content changes, affix edits, clipboard serialization, moves, persistence, and sharing must retain Header. Removal deletes the whole placement. Existing history and shared drag mechanisms remain the owners of those interactions.
- **Keep highlights attached.** Generated headings, closing tags, and affixes are parts of one chip, not independent editable text or separate drop targets. Preserve the existing protections against dropping a chip into its own generated content.
- **Reuse established UI.** Place the single-line Header input above Prepend/Append. Reuse conditional tint, option controls, read-only behavior, and existing mobile/full-screen patterns. Keep the production-backed Prompt Chips reference aligned.
- **Keep raw input separate from markup.** Header is plain heading text, not a second authoring surface for XML or Markdown syntax. Supported heading text must produce valid paired XML tags rather than executable or malformed markup.
- **Preserve sharing fidelity.** Export and import retain native editable Header data. Do not flatten Header into legacy affixes or add a legacy-export mode.
- **Record compatibility honestly.** New Header syntax extends the token language inside stored prompt strings. Older parsers do not recognize it and may treat it as literal text. The author accepted that older versions require an update.
- **Do not assume an envelope change.** Prefer extending the existing token-contained data rather than adding unrelated world/save/preset envelope fields. Any actual export-shape change requires an explicit reminder during implementation. Version changes and migration decisions remain separately user-managed.

## Testing Decisions

**Confirmed boundaries:** use the existing shared prompt renderer and gameplay prompt assembly for output checks; use real Settings → Prompts and World Editor custom prompt fields for browser interaction checks; use the production preset-sharing functions for export/import round trips. Prefer these existing seams over a new testing API.

Tests must assert externally observable output, visible controls, and persisted authored content. Do not test a duplicate formatter or assert only that an event handler ran. Keep output rules deterministic and concentrate browser checks on behavior requiring real layout, focus, selection, or user interaction.

Prior art includes the shared prompt-template and run-tiling tests, styled-preset and Persona coverage tests, narration-prompt assembly tests, preset JSON/share-code round trips, chip-affix/history tests, and the shared browser chip-interaction and Name-format checks.

| Area | Required evidence |
| --- | --- |
| Availability and defaults | Header is available on every registered prompt chip. Adding it to a chip without body formatting exposes Format initialized to Simple, independent of preset style. |
| Formatting and casing | Verify all three formats and the agreed casing examples. Switching formats repeatedly preserves raw Header input. |
| Body capabilities | Full/Summary keep supported formatting; Name stays plain text; raw-text chips retain their body verbatim. Format enables whenever Header needs it. |
| Affix order | Assert exact output with nonempty Prepend and Append, including XML content between matching tags. |
| Empty values | Blank, whitespace-only, and the existing N/A sentinel omit generated structure and affixes. Nonempty values restore the complete section. Unknown-token behavior remains unchanged. |
| Spacing | Cover inline placement, beginning/end of a prompt, adjacent headed chips, existing line breaks, deliberate extra blank lines, and empty sections between text. Assert exact strings. |
| XML boundaries | Parse representative generated fragments with an XML parser. Check matching tags, sibling built-in sections, intentional custom parent blocks, and empty-value cases. |
| Built-in adoption | Exercise every built-in prompt and format. Single-chip headings appear once, prose sections remain, and missing values do not leave empty generated sections. |
| Existing custom content | Load and round-trip custom prompts with ordinary headings and affix-based headings without rewriting their stored text. |
| Rendering parity | Feed the same real context and headed template through Preview's shared rendering boundary and gameplay prompt assembly. Compare generated sections and verify request-anatomy runs still tile the actual request text. |
| Real editor interaction | On both prompt-editing surfaces, add/edit/clear Header, change Format and Content, reopen options, and verify saved text. Check keyboard editing and mobile/full-screen behavior. |
| Highlight ownership | Selecting generated syntax opens chip options. Header and closing tags remain conditional parts of the chip; read-only fields protect them. |
| Drag and history | Move a headed chip onto ordinary and blank lines; verify Header, affixes, and selections survive. Reject self-drops into generated heading/tag content. Exercise cancellation, undo, and redo. |
| Persistence and sharing | Reopen saved prompts and round-trip JSON and share-code exports through production functions. Verify raw Header, affixes, and remembered Format remain editable. |
| Visual reference | Compare with the production-backed Prompt Chips reference. Inspect static DOM and screenshots at realistic desktop/mobile sizes and in both themes. |

Measure coverage on changed modules. Reintroduce the relevant defects to prove the new regression checks fail, then restore the implementation. Preserve real mechanics and assertions rather than changing fixtures to avoid failures.

Implementation completion requires the project's four code gates, a reviewed changelog update, graph refresh, and live UI evidence. Built-in prompt changes also follow the project's prompt-verification requirements; do not infer model-output quality from deterministic formatting tests. Record verification runtimes and any remaining limits.

## Out of Scope

- Implementing this feature as part of writing the spec.
- Replacing or removing Prepend/Append.
- Configurable heading levels or a separate Header Format control.
- Automatic conversion or a conversion wizard for existing custom prompts.
- Repairing arbitrary XML or Markdown authored around a chip.
- Formatting raw chip bodies that do not already support formatting.
- Adding Header to World Editor Placeholder Chips; the scope is prompt-variable chips, including those inside world custom prompts.
- A legacy export mode or flattening Header for older apps.
- Changing narrative instructions, model tuning, or unrelated prompt wording.
- New drag libraries, cross-editor chip moves, or a separate Header drag mechanism.
- Automatic version bumps, save/world migrations, or rewriting existing custom presets.

## Further Notes

The author confirmed the design after a structured discussion. The initial suggestion to initialize newly exposed Format selectors from a preset's style was explicitly rejected. **Simple is the agreed initial value.** Built-in presets remain read-only; their adoption happens in the authored defaults, not through user editing.

Header stays attached to its chip. Removing or moving the chip includes the heading and generated closing tag; clearing Header alone keeps the chip and its affixes.

Existing custom prompts retain their contents. The built-in rollout intentionally changes the empty-section behavior only where headings are adopted: blank or N/A values now remove their generated section.

This spec publishes the agreed feature for implementation planning. It does not authorize implementation, a version bump, a migration, or a release by itself.
