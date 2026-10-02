# 07: Audit World-Content Selects

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Breadcrumb Picker spec](../spec.md)

## What to build

A list of every plain Select that offers world content and so falls under the Q11 rule (Q13). No code change.

- World content: stats, traits, trait groups, entities, placeholders, locations, dictionaries, and anything else an author creates in a world.
- One row per call site: the screen, what the list offers, whether it can grow long, whether it has a nesting source (folders, groups, owners), and a short note on fit.
- Add the list to this ticket under an `## Answer` heading. The user picks which ones become follow-up tickets.

## Acceptance criteria

- [ ] Every Select call site was checked. The ticket records the total and how many match.
- [ ] Each matching row names its screen and its nesting source, or "none".
- [ ] Fixed option sets (timing, daypart, theme and so on) are left out and counted, not listed.
