# 04: World Scripts Get The Rider And Insert

Status: done
Blocked by: 01, 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: the trait pattern applied to the world, with the no-owner reads as the one new case.

## What to build

The world's Scripts section is a code surface (Q6). The world home line says a world script has no owner (Q3). While the section is visible it registers Insert, and Insert adds a new world script in the fenced timing and lands on it (Q4). With no owner named, the help code test runs as a world script (Q8).

## Acceptance criteria

- [ ] A question on the world's Scripts section with no code words gets the rider and the world home line.
- [ ] Insert writes a new world script in the fenced timing and lands on it.
- [ ] Leaving the section removes the Insert target.
- [ ] The help code test with no owner named runs as a world script.
- [ ] The World Editor code-insert view test has a world case; the code-rider and code-test session tests cover the world home.
- [ ] The help code probe gains world cases at the existing bar (Q9).
