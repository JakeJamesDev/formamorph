# Formamorph Design System Foundation

Status: ready-for-agent

## Problem Statement

UI prototypes vary between sessions enough to look like different apps. Approving a prototype does not provide confidence that its implementation will fit Formamorph. Existing components and theme values provide useful foundations, but agents need a shared visual reference, composition rules, and a repeatable review process.

The user has approved Settings Display and Output, the markdown editor, and community creation cards as starting points. These examples establish direction without declaring every detail final. Functional app copy should also follow ASD-STE100; the existing short-description rules alone do not establish compliance.

## Solution

Create an authoritative repository guide, a dev-only live showcase using production components, and a project skill that directs UI and prototype work through both. This first build establishes the foundation; alignment of other existing screens is separate work.

The design system has six connected layers:

| Layer | Purpose |
| --- | --- |
| Foundations | Shared semantic colors, typography, borders, radii, spacing, and focus treatment |
| Controls | Consistent buttons, segmented options, fields, checkboxes, sliders, dropdowns, separators, and split buttons |
| Composition patterns | Named layouts and density suited to settings, editing, and community cards |
| Writing | STE review by copy role, controlled product terminology, brief descriptions, and optional detail |
| Showcase | Live, inspectable examples of the approved patterns and their states |
| Project skill | A repeatable route from the task to the guide, components, and verification evidence |

### Acceptance Criteria

- The guide explains when each approved pattern applies, its layout and density, its controls, its responsive behavior, and its copy rules. It maps each pattern to its production components.
- The showcase represents Settings Display and Output, the markdown toolbar and editing surface, and community creation cards using the components that the app uses.
- The showcase is directly reachable through the existing dev router and is excluded from production behavior.
- Representative default, selected, disabled, focus, validation, and overflow states are inspectable where applicable.
- Desktop and mobile layouts retain one visual identity; adaptations are documented per pattern.
- Existing light/dark appearances, palettes, and font choices remain supported. HDR screenshots establish composition, not exact color values.
- The project skill applies to UI changes and prototypes, points to the authoritative guide and showcase, and requires evidence before claiming visual consistency.
- New patterns are proposed in a representative Formamorph screen, including their mobile form, and require user approval before adoption.
- Functional copy receives vocabulary, grammar, terminology, and meaning review against the actual STE standard. Review identifies unresolved clauses instead of claiming unverified compliance.
- The implementation passes the project's required code and UI checks.

## User Stories

1. As the product owner, I want prototypes to use Formamorph's established visual language, so that approving one gives me a dependable implementation reference.
2. As the product owner, I want new visual patterns proposed explicitly, so that a feature request does not silently change the app's identity.
3. As the product owner, I want proposals shown inside a representative app screen, so that I can judge them beside existing UI.
4. As the product owner, I want the mobile form included in new-pattern proposals, so that approval covers more than desktop composition.
5. As an implementing agent, I want one authoritative guide and live showcase, so that design decisions survive across sessions.
6. As an implementing agent, I want each approved pattern mapped to production components, so that I can reuse the established implementation.
7. As an implementing agent, I want the project skill to cover prototypes as well as production work, so that experimentation respects the same design boundaries.
8. As an implementing agent, I want named layout and density patterns, so that different surfaces can serve their purpose without inventing unrelated styles.
9. As an app user, I want controls, text roles, borders, and theme colors to remain consistent, so that familiar actions remain recognizable across surfaces.
10. As an app user, I want my selected palette and font to remain supported, so that the design system preserves appearance preferences.
11. As a mobile user, I want explicit layout adaptations, so that controls remain usable on smaller screens.
12. As a keyboard user, I want visible focus and usable controls, so that interaction does not depend on a pointer.
13. As a settings user, I want labels and controls aligned consistently, so that I can scan and compare settings.
14. As a settings user, I want clear section headings and dividers, so that related settings form understandable groups.
15. As a settings user, I want brief descriptions with necessary detail available behind the information control, so that I can choose how much explanation to read.
16. As an author using the markdown editor, I want compact tool groups with vertical separators, so that I can distinguish related formatting actions.
17. As an author using the markdown editor, I want split buttons to preserve their current-action and dropdown behavior, so that familiar editing workflows keep working.
18. As an author using the markdown editor, I want Edit and Preview states to remain clear, so that I can distinguish source text from rendered output.
19. As a community browser user, I want cards with readable art overlays and a clear content hierarchy, so that I can scan listings.
20. As a community browser user, I want tags, counts, and secondary actions arranged consistently, so that metadata is easy to find.
21. As a reviewer, I want long content and overflow examples, so that the reference demonstrates realistic limits rather than only ideal content.
22. As a reviewer, I want selected, disabled, focus, and validation states where applicable, so that approval covers more than a static default appearance.
23. As an app user, I want settings, help, tooltips, errors, confirmations, and tutorials written in controlled, clear English, so that I understand what to do and what happened.
24. As an app user, I want consistent product terminology, so that the same concept is not renamed between screens.
25. As a content author or player, I want authored content and generated stories to retain their own voice, so that functional-copy rules do not rewrite creative content.
26. As a copy reviewer, I want review criteria suited to labels, descriptions, instructions, status/errors, and extended help, so that one sentence convention is not applied indiscriminately.
27. As a maintainer, I want uncertain STE rules recorded honestly, so that a word-count check or AI rewrite is not mistaken for compliance.
28. As a maintainer, I want new UI work to follow the approved system immediately and older surfaces aligned in planned passes, so that adoption has a controlled scope.

## Implementation Decisions

- **Authority:** Follow the confirmed repository-authority decision. The guide and live showcase are authoritative; maintaining a second authoritative design in an external suite is not required.
- **Approved references:** Preserve Settings Display/Output alignment, section dividers, widget variety, and optional detail; markdown toolbar grouping, separators, split buttons, and Edit/Preview selection; community card art/title composition, description hierarchy, metadata, tags, and secondary actions.
- **Reuse:** Use the existing settings row primitives, markdown field and toolbar, community card and card shell, typography roles, and theme system. The markdown toolbar's split buttons are currently internal; expose reusable composition only where needed to let the showcase and production share behavior. Do not create showcase-only copies of production markup or a parallel token set.
- **Layout:** Share visual foundations across the app while allowing named composition and density patterns. Document the approved patterns first. Gameplay-specific composition is a future application of the system, not a new layout to invent in this slice.
- **Responsive behavior:** Define mobile adaptations for each showcased pattern. Preserve existing settings behavior such as stacked rows and dropdown alternatives to segmented controls where already supported.
- **Preferences:** Derive values from the app's theme and typography system. Preserve supported palettes and font choices; the reference screenshots' purple palette is not a mandatory default.
- **Showcase:** Integrate through the existing dev-router mechanism and development gate. Render representative production compositions with inspectable states and realistic content. Keep any demonstration interactions local or stubbed where needed to prevent real publishing, downloads, account changes, or model calls.
- **Interaction preservation:** Reuse the actual editor behavior, including selection handling and split-button actions. A showcase is not permission to replace established controls with decorative equivalents.
- **Writing scope:** Target full ASD-STE100 for functional app-authored copy. Preserve authored worlds, community posts, and generated story prose. Labels use consistent product terminology.
- **Copy roles:** Distinguish labels, descriptions, instructions, status/errors, and extended help. Retain one-sentence, third-person setting descriptions of at most 12 words and optional additional detail; use imperative wording for instructions. Do not extend a setting-description convention to every copy role.
- **STE evidence:** Consult the actual standard's writing rules and dictionary, with documented product terminology. Resolve label-fragment and capitalization treatment before claiming compliance for labels. Record any conflict with an existing local rule instead of silently changing the agreed scope or weakening the target to an STE-inspired subset.
- **Skill workflow:** Direct agents to read the guide, choose the applicable pattern, reuse its components, and verify against the live showcase. Established-pattern work is agent-reviewed; a new pattern needs contextual user approval before it enters the approved reference. Keep visual values in production components and the guide rather than duplicating them in skill instructions.
- **Adoption:** Apply approved rules to new work. Schedule alignment of older surfaces separately. Do not modify unrelated screens as part of building the foundation.
- **Data contracts:** No save/world export shape, version, external API, or persistence schema changes are required.

## Testing Decisions

The user confirmed the testing boundary: the live showcase is the primary integrated verification surface, supported by existing component behavior tests and dev-route coverage. STE review is separate.

- **Behavior over internals:** Test observable actions and outcomes through real components. Add automated tests for meaningful new behavior or regression risk, not to mirror markup or duplicate implementation decisions. Structural DOM checks can support an invariant but do not establish visual quality.
- **Existing seams:** Reuse the established settings alignment and row tests, markdown formatting/preview/history/fullscreen tests, community card behavior tests, settings-copy checks, and dev-router drift guard. Extend these only where changes create a relevant risk.
- **Showcase reachability:** Verify direct dev-router access and inspect the real compositions without menu navigation. Check that the new development surface does not become a production route or production-only side effect.
- **Settings:** Verify label/control alignment, optional information, selected values, checkboxes, sliders, and responsive adaptations using representative Display and Output content.
- **Markdown:** Verify formatting on selected text, current split-button action and dropdown choices, and Edit/Preview behavior through the reused editor. Preserve existing interaction coverage when exposing any internal control for reuse.
- **Cards:** Verify the approved hierarchy, readable title treatment, tags, counts, and secondary action states with realistic content. Use controlled fixtures and callbacks for demonstration actions.
- **Visual evidence:** Inspect desktop and mobile layouts in light and dark appearances. Confirm theme/font inheritance and representative supported variations. Use static screenshots, DOM reads, and structural evidence; do not infer animation timing from hidden-tab behavior.
- **States and accessibility:** Inspect applicable default, selected, disabled, keyboard focus, validation, and overflow cases. Respect reduced-motion behavior where affected. Test realistic long text and wrapping rather than reducing content to hide problems.
- **Writing evidence:** Review vocabulary, word meaning, grammar, and technical terminology against the official standard. Retain existing copy-rule checks as local guards; passing them does not certify STE compliance. Record unresolved clauses and the limits of completed review.
- **Skill and guide review:** Walk an established-pattern task and a proposed-new-pattern task through the written workflow. Confirm that both lead to the authoritative examples and that the latter reaches the required approval step without duplicating styling rules.
- **Completion gates:** Run typecheck, lint, the test suite, and the production build for implementation. Time each test run and report its elapsed time. Apply the project's coverage and regression-proof requirements to new tests, update the knowledge graph after code changes, and record the first build in the appropriate In-Progress changelog bucket.

## Out of Scope

- Implementing the feature while writing this spec.
- An app-wide redesign or bulk rewrite of existing functional copy.
- New gameplay layouts or redesign of another existing screen.
- Replacing palettes, font preferences, or the component library.
- A separate mobile design system or public-website design system.
- Figma setup, a required external design suite, or duplicate design authority.
- Applying STE to user-authored content or generated story prose.
- Building a general STE checker or treating AI output as compliance evidence.
- Version bumps, export migrations, or schema changes.

## Further Notes

- [Confirmed design and source map](../../designs/design-system/design.md) records the interview decisions and links to the existing components.
- [Design authority decision](../../../docs/adr/0008-design-authority-in-repository.md) records why design authority stays in the repository.
- [Product glossary](../../../CONTEXT.md) provides established domain vocabulary.
- [Official ASD-STE100 guidance](https://www.asd-ste100.org/STE_faq.html) explains the standard; use its full rules and dictionary for implementation review.
- The first build is the guide, project skill, and dev-only showcase. The user's confirmation reserves implementation for a follow-up; this spec makes that work ready for an agent.
