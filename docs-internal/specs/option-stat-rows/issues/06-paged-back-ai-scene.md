# 06: Paged-Back AI Scene

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

On a paged-back turn, the AI scene's entity stats read the current Option values for Option toggles, while the panels read that turn's values. The scene must read the viewed turn's values. Also widen the Q17 no-leak test: it covers the narration request and global rows only. Add entity rows and the stat pass request.

## Acceptance criteria

- [ ] On a paged-back turn whose Option value differs from the current one, the scene's entity stats follow the viewed turn's value.
- [ ] No Option row text reaches the narration or stat pass request, for global and entity rows.
- [ ] Each guard goes red with its bug reinstated.
