# 07: Test Bench Lens Starts

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Ticket 04 found that the Test Bench lens pin plan seeds entity stats without Option or trait starts, and that its global stats leave out the cast's default global rows. The Bench's opening fold is already right. The lens must seed stats through the same opening steps (spec Q27, Q29), with the author's picked Option values.

## Acceptance criteria

- [ ] In the Test Bench lens, with Easy giving the Dragon "Health starting +20", a stat-band Pin on the Dragon resolves from the raised value.
- [ ] An entity's default trait start reaches the lens's entity stats.
- [ ] A cast entity's default global row reaches the lens's global stats.
- [ ] Each guard goes red with its bug reinstated.
