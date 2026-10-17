# 08: Bundled Example And Scripts Guide

Status: ready-for-agent
Blocked by: 04, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a Tool description is prompt text that needs probe numbers, plus house-style world authoring.

## What to build

One bundled world ships a During AI Output filter World Tool (Q18), written in the house style of the bundled-worlds skill. The ticket picks the world. Its description ships with probe numbers on the cloud default model: the model calls the Tool when the scene asks for it, and not otherwise, against an in-batch control. The Scripts guide documents World Tools, the three timings, Reply, Stack Calls and the new writes. The help topic for the Tools tab is added.

Spec: Q18; story 32; Further Notes (probe work, endpoints without Tool support).

## Acceptance criteria

- [ ] The bundled world loads with its Tool, and a live turn shows the filter applied after the call
- [ ] Probe numbers for call rate when asked and when not asked, with an in-batch control, recorded in the ticket's comments
- [ ] Scripts guide and help topic cover World Tools and the new writes; copy-sweep clean
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- 04 Memory And Diary Writes
- 06 During AI Output Triggers
