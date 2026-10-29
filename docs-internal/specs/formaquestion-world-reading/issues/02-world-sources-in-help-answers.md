# 02: World Sources In Help Answers

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a mechanical prefactor of one type through its readers, with no behavior change.

## What to build

A help answer's sources can hold a **world item** beside guide sections: its kind, id and display name. Follow-up history, its topic rule and the AI Context trace carry world items the same way they carry guide sections. The answer card can render a world source as a plain name. Nothing produces world sources yet; tickets 04 and 05 do. Answers look the same as today.

Spec: Q17 (shape only); story 34.

## Acceptance criteria

- [ ] A help answer can carry a world-item source beside guide sections
- [ ] A follow-up after an answer with a world source keeps that source in its history and topic rule
- [ ] The AI Context trace lists a world source with its kind and name
- [ ] The answer card shows a world source as a plain name
- [ ] Existing help tests pass unchanged
