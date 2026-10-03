# 04: Docs for Memory, the cast, Personas, connecting an AI, Android and Stat Code

Status: done
Base: 6f6228d7
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

- [x] Every row above is fixed or recorded as correct, with the code location that proves it in the commit body
- [x] Each page has "How to…" sections with numbered steps; reference text stays
- [x] Control names and Settings paths match the UI exactly, with the Advanced-mode note where it applies
- [x] The memory manager, entities and linked content help topics agree with the pages
- [x] The known-gaps entries for these surfaces and topics are removed, and the coverage test passes
- [x] Four gates green

## Comments

**Built.** Each audit row and its code location is in the commit body. Findings beyond the rows:

- Library Additions are removable in play, like story-invented entities (`GamePanels.tsx:325-336`).
- The desktop app starts on **Built-In Engine**, not the Demo AI (`SettingsContext.tsx:276-290`).
- `Math.random()` shares a seed often, not always: 50 QuickJS contexts in a row gave 10 distinct first values.
- `aiSetup` now maps to its own section, Connect-Your-Own-AI "The Set Up Your AI Dialog".

**Seen, not fixed (outside this ticket):**

- `settingsCopy.ts:238,248` say "the **Log** panel"; the tab is **Logs**. `describeNewCharacters` info says "**Characters** panel"; the tab is **Entities**.
- `SettingsModal.tsx:294` says "**AI Endpoints** tab"; the tab is **Endpoints**.
- `MainMenu.tsx:2366` empty state calls the Persona control a "checkbox".
- The Enter World button reads "Start game", not Title Case. Several dialog titles are sentence case ("Set up your AI", "Local model").
- The removable check compares display names, so an unrevealed authored entity may show a remove button (`GamePanels.tsx:135,321`). Untested.
- `linkToast.test.tsx` errorDetails test times out at about 1 s under full-suite load; it passes alone.
