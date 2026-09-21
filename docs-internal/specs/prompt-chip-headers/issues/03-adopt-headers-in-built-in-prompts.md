# 03: Adopt Headers in Built-In Prompts

Status: ready-for-human
Status note: Four gates green; Standards and Spec reviews found no actionable issues. Header adoption and both requested popover corrections are verified.
Base: 9f278115
Blocked by: 02 — Offer Headers on Every Prompt Chip
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

Parent: [Prompt Chip Headers](../spec.md)

Model rationale: This applies the established Header behavior across authored defaults and style generation. The demanding work is a systematic adoption audit, XML peer-boundary verification, and production prompt regression evidence.

## What to build

Every built-in section consisting of one prompt chip uses Header rather than separately maintained heading text or heading-only affixes. Built-in Simple, Markdown, and XML prompts render each section consistently and omit it when its value is empty. Prose sections such as Guidelines remain authored text.

Ticket 02 completes Header support across the registry and depends on ticket 01; this ticket needs both capabilities before converting all built-in sections. Existing custom prompts remain snapshots with their stored content untouched.

## Acceptance criteria

- [x] Audit every built-in prompt and convert every section consisting of one chip. Record the adoption inventory in the implementation evidence, including any sections retained as authored prose and the reason.
- [x] Each converted placement stores one raw Header. Remove superseded ordinary heading text and heading-only Prepend/Append fragments so headings appear once. Preserve any affix wording that is actual section content.
- [x] Built-in style generation selects the corresponding chip Format for Simple, Markdown, and XML. Headings derive from Header data; style conversion does not rewrite raw Header text or regenerate literal affix headings. This does not change the agreed Simple default for newly headed raw-text chips in custom prompts.
- [x] XML peers remain siblings, including Traits and Player Character. Converting a conditional heading must not leave a preceding section open or nest later sections accidentally. Existing prose sections and their boundaries remain valid.
- [x] Blank, whitespace-only, and N/A values remove the adopted section's heading, wrappers, affixes, and generated spacing. Nonempty values restore it with the agreed casing and spacing. Name bodies stay plain, and raw-text chip bodies retain their content.
- [x] Read-only built-in presets display generated headings and closing tags with the shared conditional highlight and protected chip options. Header and Format can be inspected but not edited. Editable copies preserve native Header data and support the editing behavior delivered by tickets 01 and 02.
- [x] Existing saved custom prompts, including ordinary headings, affix-based headings, and intentional XML nesting, load and round-trip without content rewriting or automatic Header inference. No conversion wizard, migration, version bump, or legacy flattening is introduced.
- [x] Production preset sharing preserves editable Header data for custom copies of converted built-ins. Record older-version incompatibility and explicitly report any actual export-envelope shape change.
- [x] Preview, gameplay prompt assembly, and request-anatomy runs agree for converted built-ins in every style. Narrative instructions, unrelated wording, and model tuning remain outside this change.

## Verification and completion

- Exercise **every built-in prompt in every supported style** through production style generation and rendering. Assert headings appear once, prose remains, and populated/empty contexts produce the intended section boundaries and spacing.
- Use an XML parser on representative generated fragments. Specifically verify Traits/Player Character siblings, transitions between generated and authored sections, missing Persona, and preservation of intentional parent blocks in custom prompts. Do not treat string matching alone as XML validation.
- Compare converted templates through the shared Preview renderer and production gameplay assembly with real context; verify request-anatomy runs tile the actual request. Use the production preset-sharing functions for JSON and share-code round trips.
- Through real Settings prompts, inspect read-only built-ins and edit a custom copy. Through real World Editor custom prompt fields, verify copied Header-bearing templates remain editable, persist, and retain drag/history behavior. Include generated-highlight ownership and a raw-text chip's Header-only Format behavior.
- Review static desktop/mobile evidence in both themes against the production Prompt Chips reference. Keep that reference consistent with the final built-in behavior.
- Follow the project's prompt-writing and model-probe requirements for changed AI-call text: record the required before/after runs and metrics for both reference model tiers and check other metrics for regressions. Deterministic format tests alone do not establish model-output quality.
- Measure changed-module coverage and prove relevant regression checks fail with their defects reinstated, particularly duplicate headings and incorrect XML nesting. Record test runtimes, complete all four code gates, update the changelog, and refresh the graph.

## Scope boundary

Adoption changes authored defaults only. It does not reinterpret users' stored custom prompts, repair their authored markup, introduce new narrative instructions, or authorize a release.

## Implementation evidence

See [the adoption inventory and verification report](../verification-03.md) for all 30 templates, model comparisons, compatibility, browser checks, and test evidence.

The user selected cloud default + local Cydonia for the model comparison and approved preserving historical replay templates with separate current-Header request tests. Follow-up visual feedback also aligned chip hint sizes and replaced the tall chip popover's native scrollbar with the shared ScrollArea.
