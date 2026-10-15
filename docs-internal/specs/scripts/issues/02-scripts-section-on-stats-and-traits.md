# 02: Scripts Section On Stats And Traits

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a shared editor section used from three homes, plus a new run gate in the turn runner.

## What to build

The stat editor's Code tab becomes a Scripts section with an **Add Script** button. Each script is the box authors know today, with a timing dropdown, an optional name field and a remove action (R3, Q6). The trait editor gains the same section. A trait's scripts run only while the trait is active (Q3). The dropdown is the only way to change a timing (Q4). Hover cards, autocomplete and Test Code work in every box as they do today.

Spec: R3, Q3, Q4, Q6, stories 1, 5.

## Acceptance criteria

- [ ] Add Script on a stat or a trait adds a box with timing Before the AI, an empty name and the editor focused
- [ ] The timing dropdown lists the five timings with their labels; a name left blank shows the owner and timing as the row's fallback
- [ ] A trait's script does not run while the trait is inactive; a test switches the trait off and proves no write lands
- [ ] Remove asks nothing when the box is empty and confirms when it holds code
- [ ] Four gates green

## Blocked by

- 01
