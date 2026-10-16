# 03: Trait Scripts Get The Rider And Insert

Status: done
Blocked by: 01, 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: wiring across a panel, the session and a probe, following the stat pattern.

## What to build

A trait's Scripts tab is a code surface (Q6). The trait home line names what a trait script reads (Q3). While the tab is visible it registers Insert under the trait's name, and Insert adds a new script in the fenced timing to that trait and lands on it (Q4). With no owner named, the help code test runs on the open trait (Q8).

## Acceptance criteria

- [ ] A question on a trait's Scripts tab with no code words gets the rider and the trait home line.
- [ ] Insert heads its menu with the trait's name and writes a new script into that trait, in the fenced timing.
- [ ] Leaving the tab removes the Insert target.
- [ ] The help code test with no owner named runs on the open trait.
- [ ] The World Editor code-insert view test has a trait case; the code-rider and code-test session tests cover the trait home.
- [ ] The help code probe gains trait cases at the existing bar (Q9).
