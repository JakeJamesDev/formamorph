# 16: Worker Moves

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: reuses existing worker clients; contained call-site changes.

## What to build

Importing a world from the Main Menu parses and migrates it in the existing JSON worker, as the World Editor import already does. Publishing measures its size and builds its payload in a worker. Results and error messages stay the same.

## Acceptance criteria

- [ ] Main Menu import of the bench world shows no main-thread block over 1 s at 6x.
- [ ] A malformed file still shows the same skip message.
- [ ] Publish size and payload equal the main-thread results for a fixture world (unit).
- [ ] Four gates green.
