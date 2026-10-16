# 02: Rider Asks For Five Timings

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a prompt change that a small model must follow, judged by probe numbers.

## What to build

The Default preset's Code rider names all five boxes and their fence lines (Q1, Q5). The three new timing labels count as code words, matched as whole phrases (Q6). A home line rides after the rider when a script home is open, through the same line-append path as the code-test line, and still rides with an empty rider (Q3). This ticket adds the stat's home line: `self` is the stat, `owner.stats` reads its entity. The generic rider drops `owner.stats`. With no home open, no home line rides (Q7).

## Acceptance criteria

- [ ] The Default rider names five boxes and five fence lines; labels come from the shared timing label list.
- [ ] "At Game Start", "During AI Output" and "When a Trait Switches" make a code turn; the same words split apart do not.
- [ ] On the stat Code tab the stat home line rides, with the edited rider and with an empty one.
- [ ] Off a home, a code turn sends the rider with no home line.
- [ ] The help code probe gains cases for the three new timings; existing cases do not regress and new cases meet the existing bar (Q9).
- [ ] Probe numbers ship with the change.
