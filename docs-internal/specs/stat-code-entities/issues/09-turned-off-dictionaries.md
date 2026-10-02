# 09: Leave turned-off dictionaries out of stat code

Status: done
Base: 847d8be5
Blocked by: 07
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Parent: [Stat Code Entities spec](../spec.md)

## What to build

Ticket 07's review found that the run's `dictionaries` still lists authored dictionaries the player turned off at Enter World. List only dictionaries in play (Q29).

## Acceptance criteria

- [ ] An authored dictionary turned off at Enter World is not in `dictionaries` and reads as an unknown dictionary. A pin through it is dropped and reported.
- [ ] An authored dictionary left on, and every library dictionary, still list as today.
- [ ] The editor test run and the Test Bench, which have no Enter World, keep listing every authored dictionary.
- [ ] Tests at `runStatCodeTurn`, each shown to bite. The changelog line is in In Progress.
