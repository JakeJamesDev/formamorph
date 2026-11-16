# 09: Rename Rewrites Scripts

Status: ready-for-agent
Blocked by: 04, 08
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Renaming a Media Entry rewrites the scripts that name it, as a stat rename does (Q4).

- A rename from the picker slot or the Media tab rewrites every script assignment and comparison that names the old name, using the existing rename machinery.
- The drift check flags a script that names a missing entry.

## Acceptance criteria

- [ ] Renaming an entry rewrites `entities.X.image = "<old>"` to the new name in world scripts, stat code and item scripts.
- [ ] A script naming a missing entry shows in the drift check with the name.
- [ ] A string that only happens to match the name outside a media assignment is left alone.
