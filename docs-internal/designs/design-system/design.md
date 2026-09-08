# Formamorph Design System

> Design confirmed. Implementation is reserved for a follow-up task.

## Purpose

Keep UI work consistent across sessions, including prototypes. An approved prototype must provide a dependable visual reference for its implementation.

## Approved starting points

| Reference | Patterns to preserve |
| --- | --- |
| Settings: Display and Output | Aligned controls, section dividers, widget variety, brief explanations, optional detail |
| Markdown editor | Compact toolbar, vertical tool separators, split buttons with dropdowns, Edit/Preview selection |
| Community creation cards | Image-led composition, title overlay, description hierarchy, metadata, tags, secondary actions |

These references are starting points, not declarations that every detail is final. Screenshot colors are affected by HDR; use the app's theme values for color specifications.

## Settled decisions

- **Q1 — Scope:** One app-wide foundation, with layouts suited to settings, editing, gameplay, and community browsing.
- **Q2 — Prototype freedom:** Reuse established visual styles. Propose new visual patterns explicitly before introducing them.
- **Q3 — Writing target:** Target full ASD-STE100 for app-authored settings, help, and explanations, with documented product terminology and a defined UI scope. This target is not a claim that existing copy complies.
- **Q4 — Authority:** The repository guide and a live showcase built from actual app components are authoritative.
- **Q5 — Writing boundary:** STE covers functional app copy, including settings, help, tooltips, errors, confirmations, and tutorials. Labels use consistent product terminology. User-authored content, community posts, and generated story prose retain their own voice.
- **Q6 — Adoption:** New UI work follows the approved rules immediately. Existing surfaces receive separately planned alignment passes.
- **Q7 — Consistency:** Share controls, typography roles, borders, and theme colors. Use named layout and density patterns for different purposes.
- **Q8 — Mobile:** Preserve the shared visual identity and define explicit mobile adaptations for each pattern.
- **Q9 — First build:** Create the guide, project skill, and dev-only showcase of the three approved references. Additional screen redesigns are outside this slice.
- **Q10 — Copy review:** Retain concise setting descriptions and optional detail. Review prose against STE vocabulary, grammar, and meaning; AI rewriting and length checks alone do not establish compliance.
- **Q11 — Visual approval:** Agents verify established patterns against the showcase. The user approves new patterns demonstrated in a representative app screen, including their mobile form, before adoption.

## Implementation structure

| Layer | Responsibility |
| --- | --- |
| Foundations | Existing semantic colors, typography roles, borders, radii, spacing, and focus treatment |
| Controls | Buttons, segmented options, fields, checkboxes, sliders, dropdowns, tool separators, and split buttons |
| Composition patterns | Settings forms, markdown editing tools, and community cards; named layouts and density for each purpose |
| Writing | STE review by copy role, product terminology, concise descriptions, and optional explanatory detail |
| Showcase | Live examples using production components, with responsive and interactive states |
| Project skill | Read the guide, select applicable patterns, reuse their components, and verify the result against the showcase |

The initial patterns come from the approved references. Gameplay-specific composition remains part of later feature work and uses the same approval process for new patterns. Existing palettes and font choices remain supported; a screenshot's selected purple theme does not make purple mandatory.

The showcase must expose representative default, selected, disabled, focus, validation, and overflow states where applicable. Verification uses static frames and structural evidence across desktop/mobile layouts and light/dark appearances. Existing app UI verification remains part of the implementation checks.

## Writing review

Classify strings as labels, descriptions, instructions, status/errors, or extended help. Preserve the existing product glossary and document technical terms against the standard's rules. Descriptions explain behavior; instructions use imperative wording. Keep the current short setting descriptions and place necessary detail behind the information control.

Full STE compliance is a target, not an automatic label. Review against the official rules and dictionary; unresolved rules must remain identified as unverified. In particular, the interview's source review did not establish the precise treatment of heading capitalization or label fragments. Resolve those clauses before asserting that labels comply.

## Acceptance criteria for the first build

- The guide maps each approved pattern to its production components and explains its purpose, layout, responsive behavior, and copy rules.
- The dev-only showcase renders the three approved references using shared production components and is reachable through the dev router.
- The project skill directs UI and prototype tasks to the guide and showcase; it does not duplicate visual values into a separate styling system.
- A new visual pattern requires a contextual desktop/mobile proposal and user approval before becoming an approved pattern.
- No app-wide redesign, palette replacement, or bulk copy rewrite is included in this slice.
- Implementation passes the project's code and UI verification requirements.

## Source references

- [Settings rows](../../../src/components/SettingsRows.tsx) define responsive label/control alignment and section headings.
- [Settings modal](../../../src/components/modals/SettingsModal.tsx) contains Display and Output.
- [Markdown field](../../../src/components/prompt/PromptField.tsx) contains the toolbar and split buttons.
- [Community cards](../../../src/components/community/RemoteWorldCard.tsx) reuse the [card shell](../../../src/components/WorldCardShell.tsx).
- [Theme values](../../../src/index.css) and [typography roles](../../../src/components/ui/typography.tsx) provide existing visual foundations.
- [Settings copy](../../../src/components/modals/settingsCopy.ts) documents local copy rules; these do not establish full STE compliance.
- [Product glossary](../../../CONTEXT.md) records existing terminology.
- [Official ASD-STE100 guidance](https://www.asd-ste100.org/STE_faq.html) explains the writing rules and controlled dictionary.

## Confirmation

**Q12:** The complete design is confirmed. Finalize and commit this documentation; build the guide, project skill, and showcase in a follow-up task.
