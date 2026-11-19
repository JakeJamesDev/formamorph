# 11: Test Bench Defaults Report

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Test Bench rule report predicts which default traits start off. It still settles defaults on authored stats, so it disagrees with real setup since ticket 08 (Q26): a default opened by another default's +3 is reported as starting off. Its comment cites Q31, but Q31's authoring readers are only the editor's Requires text, code hover cards and the library entity gate input. Settle the report's defaults through the same setup gate stats real setup uses, with the author's picked Option values.

## Acceptance criteria

- [ ] A default trait opened by another default's stat row is not reported as starting off.
- [ ] A default whose gate fails even with every pick's rows is still reported.
- [ ] The guard goes red with its bug reinstated.
