# 01: State The Context Menu Rule In The Guide

Status: ready-for-human
Base: e80be92a
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

## What to build

Add the rule behind the Main Menu tile menu to the Grouped Context Actions pattern in the Design System guide. An agent who reads the section can then derive a new context menu instead of copying the existing one.

The block sits after the purpose line and before the density line. It states: every row is one of two kinds. A row that answers "which one?" belongs to a titled set. A row that does something belongs to a flat action set. A title is the flyout handle: a titled set can fold into a flyout and the title becomes the flyout label. Action rows never fold, so they carry an icon to stay apart from set rows. Separators divide kinds, not topics. A context-dependent action section sits where the fixed action section sits and keeps its icons.

The existing Composition, Production mapping, Responsive behavior, State reference, and Writing review blocks stay as the worked example.

## Model rationale

Sonnet 5 at high effort handles a short, precise prose edit in the Writing Guide functional voice. No code changes.

## Acceptance criteria

- [x] The Grouped Context Actions pattern carries a short rule block between its purpose line and its density line.
- [x] The block names the two row kinds, the title-as-flyout-handle rule, the icon-on-action-rows rule, and the separators-divide-kinds rule.
- [x] The block states where a context-dependent action section sits and that it keeps its icons.
- [x] Existing composition text is unchanged apart from the new block.
- [x] Sentences follow the Writing Guide functional voice: active, present tense, under 20 words, one topic each.
- [x] No version pin and no reference to agent-only files.
- [x] Docs link check passes.

## Out of scope

- Any code change.
- The production mapping row for the canvas menu, which ticket 03 adds once the canvas follows the rule.
