# 03: Persona and Starting Location Rows

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

A Preset value can choose a world persona and the Starting Location. The spec covers this in Q6, Q9 and Q10.

- **Apply.** Extend the apply function for persona and location rows. A persona row changes the persona before the settle, because the persona changes which owned trait trees are in play. A snapshot never resets persona or location unless a row names it.
- **Match.** Compare persona and location only when the value has a row for them.
- **Notice.** The notice names a persona or location change.
- **Editor.** The row editor offers world-authored personas and locations as targets. Player-library personas are never offered.
- **Docs.** Update [World-Editor-Options.md](docs/World-Editor-Options.md). Write a changelog fragment.

## Acceptance criteria

- [ ] A location row sets the Starting Location. A persona row sets a world persona.
- [ ] A snapshot with no persona or location row keeps the player's current persona and location.
- [ ] A persona row together with owned-trait rows for that persona applies both in one click.
- [ ] Match ignores persona and location when the value has no row for them.
- [ ] Editor: persona targets list world personas only.
