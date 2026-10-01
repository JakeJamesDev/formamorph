# 04: Docs for Memory, the cast, Personas, connecting an AI, Android and Stat Code

Status: ready-for-agent
Blocked by: 01 — Docs checks and surface map
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player can follow the existing player pages step by step, and every statement matches the app.

Pages: Memory, Entities (the runtime cast), Personas, Connect-Your-Own-AI, Install-on-Android, TextFormatting, StatCodeGuide, LinkedContent.

Verify each claim against the code. Audit leads:

| Page | Claim to check |
|---|---|
| Memory, When Each Memory Happened | Puts Measured Clock and Time in Memory under Output → Memory. They are in the Time section |
| Memory, Turning Memory Off; Entities, Descriptions; help topic: entities | Name Output sections with no note that those sections show in Advanced mode only |
| Memory | No mention of Milestone Select, Character Diaries, Diary Recall, Memory Cap or Scene Recall |
| Entities, How a Game Opens | Disagrees with the Openings page on Library Additions openings. Ticket 03 finds the truth; apply it here |
| Install-on-Android | Says Settings → **AI Endpoints**. The tab is **Endpoints** |
| StatCodeGuide | Points to the world format page for `beforeCode`, which that page lacks (ticket 05 adds it) |
| StatCodeGuide, Traits | Does not say whether `traits` includes entity-owned traits. Unverified |
| TextFormatting | The "ten colors" count is unverified |

Add "How to…" sections (Q20). At least: connect LM Studio, connect Ollama, connect a hosted API, use the desktop engine, install on Android, edit a memory, turn memory off, pick a persona, change persona in play, remove a cast member, publish linked content, update a linked copy.

Recommended model rationale: eight pages across settings, memory and stat code, each claim traced in a different subsystem.

## Acceptance criteria

- [ ] Every row above is fixed or recorded as correct, with the code location that proves it in the commit body
- [ ] Each page has "How to…" sections with numbered steps; reference text stays
- [ ] Control names and Settings paths match the UI exactly, with the Advanced-mode note where it applies
- [ ] The memory manager, entities and linked content help topics agree with the pages
- [ ] The known-gaps entries for these surfaces and topics are removed, and the coverage test passes
- [ ] Four gates green
