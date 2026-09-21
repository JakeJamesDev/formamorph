# 05: Readmes, Changelog, and Docs

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: medium

## What to build

The player learns how to use Open Chat from the world itself. The intro readme covers setup only: pick or import an entity first, pick a persona, and what each of the four tone groups changes. The gameplay readme covers play only: the Chat layout setting by its exact name and place in Settings, switching a tone trait mid-game, the bracket channel for direction, and that choices can be switched off in Settings.

Copy follows the player-facing voice and the UI terminology rules ("entity", never "character"). Write the copy in the main session, not through a smaller-model subagent. Run the copy sweep on the result.

Append one Changelog In-Progress entry under Added, player bucket. Add Open Chat to the published docs wherever the bundled worlds are listed.

## Acceptance criteria

- [ ] The intro readme shows before the trait picks and holds no gameplay guidance
- [ ] The gameplay readme shows on entering play and holds no setup guidance
- [ ] Every setting the readmes name matches its live label, checked against the app
- [ ] The copy sweep reports no findings
- [ ] The Changelog has one In-Progress entry in the right bucket, and no version changes
- [ ] The docs list Open Chat wherever they list bundled worlds, with no mention of agent-only files
- [ ] The content test still reports zero Test Bench findings
- [ ] Four gates green
