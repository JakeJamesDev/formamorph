# 01: Thinking Room For No-Budget Calls

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it replaces the Thought Ceiling formula in the reasoning resolver, which every AI call reads, and every later ticket builds on its table.

## What to build

One table maps each strength to a Thinking Room: Minimal 128, Low 1,024, Medium 2,048, High 4,096, Extra High 8,192, Max 16,384. Model Default reads as Medium. A call that carries reasoning and sends no budget now sends `max_tokens` = Answer Cap + Thinking Room, sized by the prompt's resolved strength (the kept strength where the endpoint refuses off). Inline narration sizes its room from narration's strength the same way. The context reserve counts Answer Cap + Thinking Room. The AI Request Spec carries the resolved Thinking Room and its strength. The glossary gains Thinking Room and its Thought Ceiling entry reads Answer Cap + Thinking Room. Changelog fragment for the Novita fix.

Spec: Q1, Q2, Q3, Q8, Q9, Q15; stories 1, 2, 5–7, 15–22, 24–26.

## Acceptance criteria

- [ ] GLM-5.3 Flash on Novita, Location Change, Max Output off: `max_tokens` is 11 + the kept strength's room; the test fails with the old 200%-of-base formula reinstated
- [ ] Each strength gives its room on a no-budget call, and Model Default gives Medium's
- [ ] Inline narration's `max_tokens` follows narration's strength, with Global following the endpoint level
- [ ] A plain endpoint with no reasoning field and no known reasoning sends the Answer Cap alone, as before
- [ ] Max Output changes the Answer Cap only; the room is the same with Max Output on or off
- [ ] The AI Request Spec carries the room and strength; the context reserve matches `max_tokens`
- [ ] Four gates green
