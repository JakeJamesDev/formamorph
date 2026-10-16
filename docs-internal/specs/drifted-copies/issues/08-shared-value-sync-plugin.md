# 08: Shared Value Sync Plugin

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one Lexical plugin shared by two editors.

## What to build

One value-sync plugin for both prompt editors. A value the user didn't cause never becomes an undo step. The duplicate editable plugin goes too.

Spec: Implementation Decisions: Prompt editor value sync. Stories 16, 36.

## Acceptance criteria

- [ ] A jsdom test loads a chip input whose value arrives after mount and undo has nothing to undo, and it fails with the old code put back
- [ ] Both prompt editors use the shared plugins
- [ ] Existing prompt editor tests pass unchanged
- [ ] Four gates green

## Blocked by

- None (can start immediately)
