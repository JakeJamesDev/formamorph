# Design workflow review

Ticket [05](../../specs/design-system/issues/05-project-skill-and-workflow.md) connects the [design guide](../../../docs/Design-System.md), [writing guide](../../../docs/Writing-Guide.md), and project skill. This record distinguishes tested behavior from unresolved writing compliance.

## Discovery and workflow demonstrations

The skill lives at `.agents/skills/design-system/SKILL.md`, the repository discovery location documented by [OpenAI](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills). It keeps implicit invocation enabled. The bundled skill validator reports `Skill is valid!`.

An independent reviewer walked these two requests through the skill and actual referenced sources. These are workflow dry runs, not authorization to build another screen.

| Request | References discovered | Outcome |
| --- | --- | --- |
| Add an existing checkbox setting to an aligned settings prototype | Aligned Settings Stack; `SettingsRows.tsx` → `CheckRow`, `Section`, `HintInfo`; showcase Display controls; writing roles | Reached agent verification: checkbox behavior, label alignment, focus, desktop/mobile, theme/font inheritance, screenshots and DOM evidence. The live production-backed showcase supplies the established-pattern demonstration; no new setting was added. |
| Propose a new gameplay composition outside the three approved patterns | Shared foundations and the three pattern boundaries; new-pattern skill branch; guide adoption procedure | Reached the approval boundary: an isolated proposal must show representative desktop/mobile app context, shared controls, relevant states, and surrounding UI. User approval must precede production adoption or registry changes. No new gameplay pattern was implemented, registered, or approved in this dry run. |

## Reference agreement

| Reference | Source and state review | Responsive and inheritance review |
| --- | --- | --- |
| Settings | Production rows and controls; selected choices, disabled checkbox, focus button, context-limit error, long endpoint value; local component state | Label/control stack below `sm`; wider aligned rows; source palette/font registries style the local sample |
| Markdown | Complete `PromptField` with markdown; split-button groups, history, Edit/Preview, focus and long authored sample | Wrapping toolbar and production mobile fullscreen behavior; typography and colors inherited from the app |
| Community Cards | `RemoteWorldCard` and `WorldCardShell`; liked/pending/update actions, long title, tag overflow, focus | Two columns at `lg`, one below; existing scrim and semantic tokens. Guide clarified resting title clipping versus three-line hover expansion |

The combined navigation originally overflowed a 390px viewport to 408px. A browser regression test reproduced that failure. Flexible columns and wrapping labels retain all three references within 390px; no content was removed to make the check pass.

## Functional-copy inventory and review

Reviewed source scope: new functional text in `DesignSystemShowcase.tsx` and `CommunityCardReference.tsx`. Reused strings remain owned by `settingsCopy.ts`, `PromptField`, `RemoteWorldCard`, and their shared controls. Creative fixtures (markdown story, artwork, creation titles/descriptions/tags, author names, endpoint-profile sample name) are outside the functional-copy policy. Numbers and substituted creation names are data, not dictionary admissions.

| Source / exact text or complete family | Role | Findings and disposition |
| --- | --- | --- |
| Showcase: Display Reference, Output Reference, Control States, Markdown Editing Reference; Appearance, Scene, Narration, Turn Extras, Reasoning, Choices, Reference States | Headings | Product concepts identified. New headings now use local Title Case. Standalone-fragment grammar remains unverified under the writing guide. |
| Showcase: Live Sample, Keyboard Focus, Focused Action, Unavailable Option, Scene Images, Context Window, Endpoint Profile, World Introduction | Labels/actions | Names match their demonstrated controls. Focused Action has no business operation; it demonstrates focus. Label grammar remains unverified; casing now follows the local convention. |
| Showcase accessible names: Theme, Palette, Font, Background Fade, Narration Size, Thinking, Continue the Story, Design References | Accessible identifiers | Describe their controls; shared product vocabulary is preserved. Same label limits apply. Reused option labels and help stay with production sources. |
| Shell/registry: Development Reference, Formamorph Design System, Guide: docs/Design-System.md; Settings, Markdown, Community Cards; `{label} pattern`; Display and Output composition, Compact long-form editing, Image-led creation listings | Navigation and descriptive identifiers | Pattern names route to the guide; `Guide` identifies a repository path rather than a browser link. Fragment grammar and technical compounds remain unverified. These identifiers are not descriptive sentences certified by the length tests. |
| `This reference shows display controls.`; `These controls show the output settings.`; `These examples show the control states.`; `This editor shows the world introduction.` | Reference descriptions | Replaced subjectless descriptions with explicit present-tense subjects. Each describes the rendered reference, not a real model operation. These are reference help, not production setting descriptions. |
| `This sample shows the selected theme and font.`; `The selected theme controls the focus ring color.`; `The control shows long values on one line.` | Explanatory help | Complete sentences, one topic each. Sample behavior, focus styling, and overflow behavior are directly checkable in the live reference. Technical senses of theme, focus ring, control, and sample require the term review below. |
| `These options control additional tasks for each turn.` | Section help | Describes Turn Extras' production purpose. The showcase only changes local choices; the guide records that it does not run those tasks. |
| `This example has no image endpoint.` | Disabled-state explanation | Explicitly identifies a demonstration condition, avoiding a claim about the user's configured endpoint. Complete sentence. |
| `The value is more than 65,536 tokens.` | Validation/error | Replaces subjectless “Exceeds…” and the dictionary-disfavored verb. The visible condition is `Number(value) > 65536`; this is a demonstration limit, not a production endpoint assertion. |
| `Select a reference.` | Instruction | Imperative choice among the three tabs. Replaces repeated implementation/isolation explanations in the shell; those facts remain documented once in the guide. |
| Cards: Community Creation Cards; Selected; Complete Local Action | Heading, status indicator, action label | “Selected” is a compact result identifier. The completion button resolves the local demonstration action. Label grammar remains unverified; callback jargon was removed from the interface. |
| `Each card shows a creation. The title and author appear on the image. The description, counts, and tags appear below the image.` | Extended explanation | Three short sentences describe the actual card order. Each has a subject and one topic; full vocabulary review remains bounded by the term limits below. |
| `Select a creation.`; `Select the Like or Unlike button.` | Instructions | Imperative SELECT replaces “choose”; Like/Unlike now match the actual action names. Local pending and completion states were exercised. Action/button terminology still requires complete dictionary-meaning review. |
| `The Like action is not complete.` / `The Unlike action is not complete.`; `The local Like action is complete.` / `The local Unlike action is complete.` | Dynamic status | Complete descriptive sentences report the local promise state; completion follows the completion button. No claim of a server-side like. |
| `The selected creation is {creation name}.`; `The local update action started for {creation name}.` | Dynamic result | Reports selection or local update request only. Authored names remain verbatim. Explicit subjects distinguish the selected creation from the local action; dynamic values prevent a blanket word-count verdict. |

### Rule and dictionary evidence

Source: official [ASD-STE100 Issue 9](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf), checked September 7, 2026. The [writing guide](../../../docs/Writing-Guide.md) retains the full review process and source-page map; this record does not replace it with a subset.

- Rules 1.1–1.4 require word/meaning/part-of-speech review. The dictionary's `exceed` entry points to MORE THAN ([PDF page 238](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=238)); `choose` points to SELECT ([189](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=189)). SELECT's choice sense and forms were checked at [372](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf#page=372).
- Rule 1.5 category 19 is the candidate route for app concepts: theme (appearance mode), palette (theme color family), control (interactive widget), endpoint (AI service address), token (model text unit), reference (live example), action (local demonstration operation), and markdown (markup language). Their source meanings are the components above. This is a proposed technical-noun register; complete dictionary-alternative comparisons and admission decisions remain unverified. It does not authorize technical verbs or arbitrary adjectives.
- Sections 2–4 govern compounds, verb forms, and complete sentences. Added explanation sentences now have explicit subjects; this does not resolve all vocabulary or label-fragment questions.
- Section 5 applies to action instructions; section 6 to explanations and status. Rule 6.3 and paragraph rules apply to the long card explanation. Section 7 is not applicable: these demonstration controls contain no safety procedure.
- Sections 8–9 apply to punctuation, dynamic values, terminology consistency, and writing practice. Quoted/inserted identifiers do not establish that an authored label is itself compliant.

**Verdict: reviewed with unresolved limits; not full STE compliance.** All new functional string families are accounted for by role. Remaining dictionary/term and label-grammar limits are listed above; reused production copy and creative content were not bulk-rewritten. A qualified STE review must resolve standalone label grammar and disputed terminology before a full-compliance claim. This foundation preserves that boundary for future tasks.

## Verification evidence

Live route: `http://localhost:5194/#dev?modal=designSystem`, isolated Chromium contexts, external requests blocked, reduced motion enabled. Captures and computed-style records are in `.scratch/design-workflow/` for this task; scratch evidence is not shipped.

- Twelve static captures cover Settings, Markdown, and Community Cards at 1280×844 and 390×844 in light/dark. Root backgrounds resolve to white and dark slate respectively in the base theme. A second dark pass supplies the production purple token family and Lexend stack to the isolated document root; all three references inherit them (background rgb(14, 9, 22), font Lexend Variable). The isolated route deliberately omits SettingsProvider, so this is inherited-style verification, not saved-preference loading. All three references fit the viewport after the navigation fix.
- Focused Vitest: 31 tests passed in 6.51 s, exit 0. Showcase coverage: statements/lines 100%, branches 85%, functions 75%. Untested branches concern alternate font/system-theme cases and valid context input; browser checks supplement layout, which jsdom cannot prove.
- Browser regression: red at 408px versus 390px (1.84 s); stale-server retry red (1.79 s); refreshed-server green (8.01 s). No assertion or fixture was weakened.
- Reintroducing the fixed 8rem minimum made the browser guard fail at 408px again (1.87 s). Restoring flexible columns passed desktop and mobile (3.58 s). The final mobile navigation also grows vertically to contain wrapped labels.
- Browser interactions corrected the context value to its valid boundary, completed an Unlike action, and focused the update action. Additional state captures accompany the twelve top-of-reference captures.
- Final gates, link validation, and review disposition are recorded on the ticket.
