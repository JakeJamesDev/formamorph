# 07: World Tool Scripts In Editor Tools

Status: done
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Sonnet at high: extends existing walkers and Try It to one more script home.

## What to build

World Tool scripts get the editor help world Scripts have. Try It runs a World Tool against the open world with sample `args` and lists its reply and its staged writes without applying them. The Variable menu lists `args` from the Tool's params and the full write surface. Find All Uses and the rename offer walk World Tool scripts: a stat, trait, location, entity or placeholder rename rewrites a World Tool's code, and a Find All Uses row opens the Tools tab with the Tool selected and the line revealed.

Spec: stories 30, 31.

## Acceptance criteria

- [ ] Try It on an After the AI Tool shows the Reply and each staged write, and the world is unchanged afterward
- [ ] Renaming a stat rewrites a World Tool script that names it
- [ ] A Find All Uses row for a World Tool opens the Tools tab on that Tool and line
- [ ] In Test Code and Try It, a `diary` target the authored world lacks reports a warning line naming it as possibly discovered in play, not a failure, because the editor has no discovered cast (Q46)
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- 05 Arming, After The AI And On Call Writes
