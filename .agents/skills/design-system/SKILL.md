---
name: design-system
description: Build or review Formamorph UI changes and prototypes using the approved design patterns, production components, and live showcase. Use for rendered app surfaces; public website design is separate.
---

# Formamorph UI workflow

Read the [Design System](../../../docs/Design-System.md) before composing a UI or prototype. Select the applicable named pattern and follow its production component links; semantic values and visual authority stay in that guide and the app.

Open the guide's dev-router showcase and inspect the relevant reference before adapting it. Compare the target's composition, applicable states, desktop/mobile adaptation, and inherited theme/font with the reference. For functional copy, follow the [Writing Guide](../../../docs/Writing-Guide.md) by role, including accessible names and dynamic status text. Record source rules, dictionary meanings, technical terms, and unresolved review limits. Authored content and generated stories keep their own voice.

## Established pattern

Reuse the mapped production components for the requested surface, including prototypes. Verify the result yourself through [verify-ui](../verify-ui/SKILL.md): real desktop/mobile context, applicable interaction states, static screenshots and DOM evidence, both themes and representative palette/font inheritance. Report the reference used, observed behavior, and evidence paths. A matching screenshot alone does not verify behavior; unresolved visual or writing issues remain explicit.

## New pattern

When none of the approved patterns covers the requested composition, prepare a proposal in a representative Formamorph app screen at desktop and mobile sizes. Reuse shared foundations and controls; show the surrounding UI and relevant states so the user can judge the change in context. Keep the proposal isolated from production and the approved showcase registry.

Present the concrete proposal and request the user's approval before adopting it. Record the decision with its artifacts. Once approved, add its guide section and production-backed showcase reference together, then perform live verification. Approval of a feature does not by itself approve a new visual pattern.

Finish only the requested surface. Existing-screen alignment is separate work; finding drift elsewhere is a follow-up, not authorization for a redesign.
