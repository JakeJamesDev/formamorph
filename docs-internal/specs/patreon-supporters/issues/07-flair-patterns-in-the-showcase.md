# 07: Supporter Flair Patterns in the Showcase

Status: ready-for-human
Base: aade0d2e
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Rulings Q5, Q7, Q9, Q10; Further Notes › Design approval, Glossary)

Model rationale: design-system work with existing tokens and badges as the reference. The judgment is the user's, at approval.

## What to build

The design-system showcase shows the new Supporter Flair patterns so that the user can approve them before any surface adopts them:

- Two color tokens, one for Supporter and one for Supporter+, in both themes.
- The Supporter badge and the Supporter+ badge. Supporter+ has its own style, not only the plus sign.
- A username in each tier color.
- The Profile Image with a ring in each tier color, at each size the app uses.
- Each of these beside the existing staff badges, so that the set reads apart at a glance.

The ticket also adds the effort's terms to the glossary: Supporter, Supporter+, Supporter Flair, Supporters wall, Patreon link.

This ticket ends at `ready-for-human`. The user approves or changes the patterns.

## Acceptance criteria

- [x] The two tokens exist in both themes and meet the text contrast rule of the design system on every background a username sits on.
- [x] The showcase has a Supporter Flair section with the badges, the colored names, and the rings.
- [x] The tier colors do not read as any staff badge tint.
- [x] The design-system document describes the patterns and when to use them.
- [x] The glossary has the five terms. Copy says Profile Image, never avatar.
- [x] `verify-ui` evidence of the showcase section in both themes.
- [x] Four gates green.
