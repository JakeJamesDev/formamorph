# 03: You Mark on Traits and Enter World

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

On the **Traits** tab and at Enter World, the You pill takes the place of the colored **You** word. Rulings Q1, Q3. Sonnet, because both surfaces already mark the same owners and only the mark changes.

## What to build

A player opens the **Traits** tab. Each played owner's sub-heading and section heading reads the name and the You pill.

At Enter World, the trait category list marks the played entity with the pill. On the selected row, the pill is inverted on the primary fill. The entity heading carries the pill too. Each surface keeps its current rule for which owners are played.

## Acceptance criteria

- [ ] The **Traits** tab's entity sub-heading and section heading use the shared pill. The section's accessible name keeps its ", You" part.
- [ ] Enter World's category list uses the pill, with `onFill` on the selected row. The entity heading uses it too.
- [ ] The local colored-text **You** marks are gone from both surfaces.
- [ ] TraitsTab and Enter World workspace tests find the played owner by its name and the pill's **You** text. Removing the pill makes them fail.
- [ ] Static frames of a selected and an unselected Enter World row, in dark and light theme.
- [ ] A changelog fragment. Four gates green, exit codes read.
