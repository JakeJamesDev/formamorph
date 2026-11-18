# 09: Re-Roll Re-Makes Script Memory

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

After a stat re-roll, everything a script wrote to memory in that turn matches the re-rolled stats (Q14, Q18).

Today the re-roll re-makes Code Pins, traits and items, but a script's meets, memory pins, named memory writes, memory edits, appended memory lines and diary lines stay as the original turn made them.

- In stat re-roll mode the Turn Landing lands the replay's script memory writes: meets, memory pins, named writes, memory edits and removals, lines appended to the turn's memory, and script diary lines.
- The turn's earlier script memory goes first. Pins and named writes are keyed by turn and are replaced. Meets, memory edits and removals return to the pre-turn snapshot before the replay's land. Appended lines and diary lines on the stored turn are replaced by the replay's.
- The reset to pre-turn and the restore on Stop (ticket 03) cover memory, so a stopped re-roll puts the turn's memory back.
- Location, time, scene entities and discoveries stay kept. The AI's own digest and diaries are not touched.
- Remove this named mode difference from the module.

## Acceptance criteria

- [ ] An interface test lands a commit in re-roll mode where the script's memory pin depends on a stat; the port receives the new pin and the turn's old pin is gone. It fails on the code before this ticket.
- [ ] The same for a named memory write, a memory edit, a memory removal, an appended memory line and a script diary line.
- [ ] A character a script marked as met in the turn is not met after a re-roll whose script does not mark it; a character met before the turn stays met.
- [ ] A mounted test stops such a re-roll and finds the turn's memory as it was.
- [ ] The re-roll makes no port call for location, clock, follower placement or discoveries.
- [ ] The parity test from 02 no longer lists this difference.
- [ ] Changelog fragment written, under Fixed.
- [ ] World and save `.json` shape unchanged.

For you: in a world whose After the AI script pins a memory when a stat is low, play a turn that pins it, re-roll until the stat is not low, and check the pin is gone in the Memory Manager.
