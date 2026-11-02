# 06: On Call Tool and Choices Gaps

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Closes the three gaps ticket 04 named. Export shape: an additive change to a save, which the response must name at landing.

## What to build

An On Call Tool's inventory write reaches the rest of its turn, so output scripts and held item runs read it and a stat Currency paid by both charges in full. A stat re-roll brings back an On Call Tool's `give` or coin `pay`. Regenerate Choices reads Item Copies as a real After the AI run does, so a script that gives an item and then checks it reads the right count.

Ruling: Q48.

## Acceptance criteria

- [ ] A test through `openOutputRun` proves a During AI Output script reads an On Call Tool's inventory write made during the reply.
- [ ] A test proves a held item run reads that write.
- [ ] A test proves an On Call Tool and a During AI Output script that both pay one stat Currency charge the full sum.
- [ ] A test proves a stat re-roll brings back an On Call Tool's `give` and coin `pay`, each counted once.
- [ ] A save written before this change loads, and a re-roll of its turn behaves as it did. A test proves it, and the new saved field is optional.
- [ ] A test proves Regenerate Choices gives a script the Item Copies a real After the AI run reads. Its writes still land nothing.
- [ ] Each new guard fails when its gap returns.
- [ ] The Scripts Reference sections on World Tools and Change the Choices describe this, and a changelog fragment exists if a released behavior changes.
