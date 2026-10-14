# 13: Help, Hover Cards, Glossary And Changelog

Status: ready-for-agent
Blocked by: 03, 05, 07, 10
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: copy and docs across the help window, the glossary, the hover cards and the changelog, each in its own voice.

## What to build

The player docs, the help window topics, the hover cards and autocomplete say Scripts, name the five timings, and document `narration.*`, `player.*` and `trait` where each applies. The glossary gains Script and the five timings and puts "stat code" on the _Avoid_ line (R1). The Stat Code Guide becomes the Scripts Guide with the old route still landing. The changelog gets one entry in In Progress with a lead that stands alone.

Spec: R1, R5, Q6, Q20.

## Acceptance criteria

- [ ] Help search for 'stat code' lands on the Scripts topic
- [ ] Hover cards show `narration` fields only in a During AI Output box and `trait` only in a When a Trait Switches box
- [ ] The glossary has Script and the five timings; the copy sweep passes on every new line
- [ ] The changelog entry's lead names subject, surface and outcome by itself
- [ ] Four gates green

## Blocked by

- 03, 05, 07, 10

## Comments

From ticket 05: the Variable menu does not list `trait`; add it for the When a Trait Switches timing only.
