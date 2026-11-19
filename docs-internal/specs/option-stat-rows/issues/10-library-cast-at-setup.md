# 10: Library Cast At Setup

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The close review found two setup readers that miss Q26g's "every setup reader uses these stats":

- **Library defaults.** When a library entity joins the cast, it picks its default traits under each Option's default value, not the player's picked values. A default whose gate opens only under a picked value's row never starts selected. Pass the picked Option values when the library entity's defaults are chosen.
- **Routine gates.** The opening Routine pick reads setup stats without the library cast, so a library persona's picks never reach Routine gates. Pass the library through, as Starting Location gates already do.

## Acceptance criteria

- [ ] A library entity's default gated on a stat that the picked Option value raises starts selected.
- [ ] Under a library persona whose pick raises a stat, a Routine gated on that stat is open at the opening.
- [ ] Each guard goes red with its bug reinstated.
