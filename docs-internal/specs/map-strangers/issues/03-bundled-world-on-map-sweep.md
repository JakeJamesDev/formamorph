# 03: Bundled World On Map Sweep

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Each bundled world gets On Map values that suit it. The session proposes and the user approves before any world changes.

- Read every bundled world through the bundled-worlds skill.
- For each world, propose one table: each entity that should not be Always, its proposed value, and one line on why. Leave out entities that stay Always.
- Show the tables to the user and wait for approval. Apply only the approved values.
- Write the values through the bundled-worlds skill's process and run its checks.

Spec rulings: Q16.

## Acceptance criteria

- [ ] Every bundled world has a proposal table in the landing, including the worlds with no changes.
- [ ] Only user-approved values were written. The landing quotes the approval.
- [ ] Each changed world loads, and its entities with a value show that value in the editor. A load test or a DOM read per world.

For you: approve the proposal tables before the session writes any world.
