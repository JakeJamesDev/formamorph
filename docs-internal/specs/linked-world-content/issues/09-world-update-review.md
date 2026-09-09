# 09: World update review with requirement changes

Status: ready-for-agent
Blocked by: 06, 08
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: merges the world update path with component decisions into one review; it must not regress today's overwrite and copy choices.

## Parent

[spec.md](../spec.md) — Publishing and updating, Player edits and update conflicts, Settled follow-up decisions (Relationships over time).

## What to build

A player updating an installed world sees every component consequence in one review before anything changes.

Today's update decision, download a copy or update an existing copy, stays. Updating an existing copy now opens a combined review. It lists changed linked components with the same actions as ticket 08, new required dependencies as rows that download and link on Apply, and requirements the author dropped as rows that become independent copies with content kept. Local replacements keep their protection and default to Keep Mine. One **Apply Updates** confirmation executes the batch; a failed item keeps its previous content and offers Retry while the rest stand. Downloading a separate copy skips the review, as it does today.

## Acceptance criteria

- [ ] Updating an existing copy of a republished world opens one review with the world's changed components, new required items, and dropped requirements.
- [ ] Apply installs and links a new required item; a dropped requirement becomes an independent copy with its content intact.
- [ ] A local replacement defaults to Keep Mine and survives Apply unchanged.
- [ ] Download a copy performs no review and installs a fresh world with its current dependencies.
- [ ] A failed component in the batch keeps its content with Retry; the world and other components update.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 06 — Download a world with dependencies and add-ons.
- 08 — Component update review.
