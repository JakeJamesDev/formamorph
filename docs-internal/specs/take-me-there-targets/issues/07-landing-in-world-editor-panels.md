# 07: Landing in World Editor Panels

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Spec: [spec.md](../spec.md), rulings Q4, Q5.

## What to build

World Editor panels and the Test Bench land targets with the shared hook. Every how-to section on the World Editor pages, the Stat Code guide, Test Bench and World Format that ends at a control gets its target and registry entry. Targets name controls the request can reach without an item (a panel's toolbar, a field in the open panel), never a specific entity or location.

## Acceptance criteria

- [ ] Each World Editor panel and the Test Bench land a target: scroll, focus, pulse once; a missing target lands silently
- [ ] Every how-to section on the listed pages that ends at a control carries a target; the report-only check lists none for them
- [ ] Docs checks and existing surface tests stay green
