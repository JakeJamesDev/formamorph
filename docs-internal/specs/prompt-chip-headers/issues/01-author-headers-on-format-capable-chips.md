# 01: Author Headers on Format-Capable Chips

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: GPT-6 Astra (`gpt-6-astra`)
Reasoning effort: high

Parent: [Prompt Chip Headers](../spec.md)

Model rationale: This slice establishes shared token, rendering, and editor behavior. Contextual spacing, conditional ownership, and preservation across existing editing operations need careful reasoning across several production boundaries.

## What to build

Authors can add an optional Header to Stats, Traits, Persona, Location, and Entities chips in editable Settings prompts and World Editor custom prompt fields. The existing Format choice controls the heading and supported body formatting. The complete section remains editable, movable, persistent, and shareable as one chip placement.

Deliver the complete shared path in this ticket, including any necessary internal preparation. Leave chips without existing body-format choices to ticket 02 and built-in prompt conversion to ticket 03. Do not introduce separate screen implementations or a second drag mechanism.

## Acceptance criteria

- [ ] Each covered chip exposes a single-line Header input above the existing affix controls. Empty or whitespace-only Header leaves the existing unheaded behavior intact.
- [ ] Raw Header text and the selected Format are preserved as placement data in the token representation. Format, Content, Scope, and affix changes retain that data; generated text is never written into Prepend or Append.
- [ ] Markdown generates a level-two heading, Simple an uppercase label followed by a colon, and XML a valid lowercase tag with a matching closing tag. Ordinary words use title case in Markdown, with connecting words lowercase. All casing examples in the parent spec pass, including uppercase phrases, NPC, and iPhone. Repeated format switching leaves raw input unchanged.
- [ ] Header is plain text, not executable markup. Supported input, including punctuation and characters requiring encoding, round-trips without corrupting the token and produces valid XML boundaries. Use one shared formatting policy.
- [ ] The section order is heading/opening tag, literal Prepend, resolved value, literal Append, then the XML closing tag. Name remains plain text for Persona, Location, and Entities; Format becomes available whenever Header needs it. Clearing Header retains affixes and Format and restores the existing Name control behavior.
- [ ] A headed placement forms a separate section, including inside prose. Ensure one blank line between it and adjacent content by reusing authored line breaks; preserve additional authored breaks. Beginning/end placement, adjacent sections, and omitted sections introduce no stray generated spacing.
- [ ] Blank, whitespace-only, and the existing exact N/A sentinel omit the entire generated section, including affixes and generated spacing. Missing or unresolved tokens retain their existing behavior. Unheaded chips are unchanged.
- [ ] In custom XML, generated tags wrap only the chip and its affixes. Authored parent blocks and surrounding text are preserved; Header does not repair or reparent them.
- [ ] Edit shows generated headings and closing tags using the existing conditional highlight. Selecting either opens the same chip options. Read-only fields protect both. Generated content is neither independently editable nor a drop target inside its own placement.
- [ ] Header, affixes, and all selections survive movement, clipboard operations, persistence, cancellation, undo, and redo. Deleting a chip removes its generated content. Both editing screens use the shared interaction behavior, including keyboard and mobile/full-screen editing.
- [ ] Production JSON and share-code export/import preserve editable Header data. Existing custom prompt strings without Header round-trip unchanged. Do not flatten Header for old versions, convert existing custom headings, bump a version, or add a migration. Record older-parser incompatibility; explicitly report any actual export-envelope shape change.
- [ ] Preview, gameplay prompt assembly, and request-anatomy runs agree on rendered sections and ownership. Runs still tile the actual request text.

## Verification and completion

- Exercise the production token parser/serializer, vocabulary mutations, shared renderer, gameplay assembly, and preset-sharing functions. Assert exact output for formatting, casing, affix order, emptiness, and the spacing cases above; do not duplicate the formatter in tests.
- Parse representative XML fragments with an XML parser, including intentional authored parent blocks and empty-value cases. Verify legacy unheaded templates and custom affix-based headings retain their behavior.
- Run browser interaction checks through **both real screens**: add/edit/clear Header, switch Format and Content, reopen persisted text, select highlights, copy/paste, drag onto ordinary and blank lines, reject self-drops into headings/closing tags, cancel, and undo/redo. Include read-only, keyboard, and mobile/full-screen behavior.
- Update the production Prompt Chips reference for this scope. Inspect static DOM and screenshots at realistic desktop/mobile sizes in both themes using the repository design authority.
- Measure coverage on changed modules and prove relevant regression checks fail with their defect reinstated. Record test runtimes. Complete all four code gates, the changelog entry, graph refresh, and live UI verification required by the parent spec.

## Scope boundary

This is an independently usable custom-prompt feature for the five existing format-capable families. Built-in prompt text, Header-only Format controls for other chips, World Editor Placeholder Chips, unrelated prompt wording, and model tuning are outside this ticket.
