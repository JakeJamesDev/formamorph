# 14: Prompt UI Prototype

Status: done
Type: prototype
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a runnable UI prototype that answers a design question, not a shipping build.

## What to build

A repository prototype on a `prototype/script-prompts` branch, per the prototype workflow, that shows every `player.*` surface over the real `scriptPrompts` store from ticket 09. The question it answers: what do the prompt surfaces look like, and does the small dialog earn a place in the Design System? It shows `confirm` and a short `ask` as a choice row under the narration, `askText` and a long `ask` in the small dialog, a `player.tell` card in the turn column, and a `player.toast` (Q16, Q17). A dev route drives each one with sample text in a running game. Both themes. The prototype may fail lint and tests and never lands on main.

The user reviews it and picks the dialog pattern. The verdict, the branch and commit, and the launch command go in the spec under a Prototype heading. Ticket 10 then builds the approved pattern.

Spec: Q16, Q17, Q45.

## Acceptance criteria

- [ ] A running prototype with one launch command and a direct preview URL on its own port
- [ ] A dev route shows each of the five surfaces with sample text, in both themes
- [ ] The choice row answers the store and the script reads the pick; the dialog answers and cancels through the store
- [ ] The verdict, branch, commit and launch command are recorded in the spec

## Blocked by

- None (can start immediately)
