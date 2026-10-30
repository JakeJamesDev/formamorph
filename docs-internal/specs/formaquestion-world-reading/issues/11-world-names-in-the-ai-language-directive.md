# 11: World Names in the AI Language Directive

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: a prompt-text change with a probe.

## What to build

"Keep world names as the world writes them" lives only in the two world rules prompts. A player who edits or clears them loses it. The AI Language directive carries the rule whenever a world block is sent, as it does for control names from the guide. A request with no world block is byte-equal to today's.

Found in the close review. Spec: "The AI Language directive keeps world names as the world writes them."

## Acceptance criteria

- [ ] With an AI Language set and a world block sent, the directive keeps world names
- [ ] With no world block, the body is byte-equal to today's
- [ ] A probe run with a non-English AI Language on a few world cases, recorded in the ticket
