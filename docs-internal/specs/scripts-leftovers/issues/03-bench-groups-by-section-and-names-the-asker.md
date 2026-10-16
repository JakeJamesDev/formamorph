# 03: Bench Groups By Section And Names The Asker

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: two contained bench changes over the list ticket 02 builds.

## What to build

Script failures in the Test Bench group by the section that holds the script (Q5). The two code-check rules split their items into one finding per section: world scripts under Scripts, trait scripts under Traits, stat scripts under Stats, entity scripts under Entities. A bench prompt shows the asking script's name as muted meta text beside its question (Q9). The name is the script's own name, or the owner-and-timing fallback.

## Acceptance criteria

- [ ] A world with a failing world script, trait script and stat script shows three findings, under Scripts, Traits and Stats.
- [ ] A failing entity script groups under Entities.
- [ ] Every item still opens its own tab.
- [ ] A bench prompt shows the asking script's name in the row's meta text; an unnamed script shows the owner-and-timing name.
- [ ] Guards fail when the rules go back to one fixed Stats group, and when the choice row drops the name.
