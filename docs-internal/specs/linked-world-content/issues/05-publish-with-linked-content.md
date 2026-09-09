# 05: Publish with linked content

Status: ready-for-agent
Blocked by: 01, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Model rationale: a multi-step publication with ordering, partial success, and retry across two kinds of listing, wired into the existing publish dialog for all three kinds.

## Parent

[spec.md](../spec.md) — Publishing and updating, World publishing review: Linked Content, Component publishing: Compatible Worlds, Settled follow-up decisions (Unlisted).

## What to build

Publishing a world can publish its linked components in the same action, and publishing a component declares where it fits.

The publish dialog for a world gains a **Linked Content** section after the existing new-or-overwrite choice. Each linked component has **Include as required**, checked by default on first publication and remembered after. An owned source that is not yet published shows **Will publish with this world** and a Public/Unlisted choice that defaults to Unlisted. Unchecked content is embedded in the world with no published dependency; an unlisted source keeps its listing state. Another author's published source is never republished. On Publish, owned required sources publish first; each success persists; the world publishes only when every required source exists, and a failure leaves the world pending with Retry.

The publish dialog for a component gains a **Listing** choice, Public or Unlisted, and a **Compatible Worlds** section listing the published worlds that hold a linked copy of it, each with **Offer as add-on** and the current review state. Unlisted makes the component required-only: Compatible Worlds is disabled with an explanation. A local link removed since the last publication appears as a pending removal that Publish applies.

## Acceptance criteria

- [ ] Publishing a world with one owned unpublished required source publishes the source unlisted first, then the world with the dependency declared; the local link is preserved.
- [ ] Unchecking Include as required embeds the content; the published world declares no dependency for it and the source's listing state is unchanged.
- [ ] A required source that fails to publish leaves the world unpublished with Retry; the sources that succeeded are not republished on retry.
- [ ] Publishing a component with Offer as add-on for one world creates the association; the world author sees it as unreviewed.
- [ ] Choosing Unlisted disables Compatible Worlds and publishes no associations.
- [ ] Removing a local link, then publishing the component, removes that association.
- [ ] Type check, lint, tests, and build pass.

## Blocked by

- 01 — Link metadata on world content.
- 04 — Server: listing relationships and Unlisted.
