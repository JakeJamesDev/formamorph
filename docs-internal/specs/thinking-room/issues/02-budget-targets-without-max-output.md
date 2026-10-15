# 02: Budget Targets Without Max Output

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one branch in the budget planner, with the dialect floor already in place.

## What to build

A target that takes a reasoning budget, with the endpoint's Max Output off, sends the Thinking Room as its budget, raised to the dialect's floor. `max_tokens` is Answer Cap + that budget. With Max Output set, the percent-of-Max-Output budget works exactly as now.

Spec: Q7, Q10; story 11.

## Acceptance criteria

- [ ] With Max Output off, a budget target sends the strength's room as its budget and `max_tokens` = Answer Cap + budget
- [ ] A dialect floor still wins: an Anthropic budget target at Minimal sends 1,024
- [ ] With Max Output set, the body is byte-equal to today's for every budget dialect
- [ ] Four gates green
