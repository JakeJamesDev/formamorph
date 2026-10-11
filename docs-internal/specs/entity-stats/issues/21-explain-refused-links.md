# 21: Explain Refused Links

Status: done
Blocked by: 19
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: a small UI addition across the trait and stat Link menus; the new pattern needs the user's approval before it is built.

Parent: [Entity Stats spec](../spec.md)

## What to build

When an author can't link a Blueprint onto an entity, the menu says why. Today a refused row shows as checked and disabled in **Link To…**, or is missing from **Link Stat**, with no reason. Every refused row now carries a short reason, such as "Bram already owns Trust" or "Bram already links Hardy". This covers trait and stat Links, single and group. Ruling Q73.

## Acceptance criteria

- [ ] Before building, a mock of the refused row's reason (placement and wording) goes to the user and is approved. It is a new UI pattern (Design System).
- [ ] Every refusal in **Link To…** (traits and stats) and **Link Stat** shows its reason: the entity already links that Blueprint, already owns a stat under its id after Detach, or holds a group that contains it.
- [ ] The reason follows the Writing Guide and passes the copy-sweep.
- [ ] The row stays keyboard reachable, and screen readers read the reason.
- [ ] The Design System showcase gains the pattern.

## Completion checks

- [ ] Run typecheck, lint, tests, and the build; report the timed test result and investigate unexplained process tail time.
- [ ] Prove each new guard fails when its rule is removed; never remove a real trigger to go green.
