# 03: Location, Clock And Discovery Writes

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: widens the sandbox on purpose and adds a precedence rule to the Turn Commit.

## What to build

Every script (stat, trait, world, and later World Tool scripts) can move the location, advance the story clock, and discover an entity (Q8, Q11). A location or entity the world does not have throws in the script (Q14). The writes stage like stat writes, so a regenerate, cancel or stopped turn drops them (Scripts Q44). In the Turn Commit, a code write to a field beats the matching pass output for that turn: location against the location pass, clock against the time pass, discovery against the discover pass (Q13, Q15). Within code writes, later wins, as today. The Variable menu and the Scripts guide list the new calls.

Spec: Q8, Q11, Q13, Q14, Q15; stories 17–19, 23–25.

## Acceptance criteria

- [ ] An After the AI Script moves the location, advances the clock and discovers an entity; the committed turn shows all three
- [ ] A code location write beats the location pass in the same turn; with no code write, the pass result commits unchanged
- [ ] An unknown location or entity name fails the script with an error, and its other writes drop
- [ ] Regenerate drops the writes
- [ ] Each guard bites when its bug returns (pass wins; unknown name creates)
- [ ] Changelog fragment written
- [ ] Four gates green

## Blocked by

- None (can start immediately)
