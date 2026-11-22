# 04: Opening Script Global

Status: ready-for-agent
Blocked by: 01, 02, 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Scripts read a read-only `opening` in every Timing on every turn (Q4). It holds `category` "opening", `id`, `name`, `owner`, `kind`, `self`, `time`, `weather`, and `text` with its placeholders filled in as the player saw it (Q16). `owner` is the owner's full entities or locations entry, or null for a world row (Q6). `opening` is null when the resolved record is null (Q7).

Test Code and the Test Bench get one shared opening picker, default None (Q12). It lists every Opening by name or derived label (ticket 01). This ticket owns the picker; ticket 06 feeds the Opening Condition from it.

The code surface, completions and quick reference list `opening` beside `turn` and `world`.

Ships its own docs: the scripting wiki's globals section and a changelog fragment.

## Acceptance criteria

- [ ] An At Game Start script and a later-turn script both read the drawn Opening's name, kind, self, time, weather and filled-in text, in the stat-code turn runner.
- [ ] `opening.owner` is the entity entry for an entity's Opening, the location entry for a location's, and null for a world Opening, and its `category` tells them apart.
- [ ] `opening` is null for the shipped default opening and for a null record.
- [ ] After a page-one re-roll, the next script run reads the new Opening.
- [ ] Test Code and the Test Bench read None by default, and read the picked Opening after a pick.
- [ ] Completions and the quick reference list `opening` and its fields as read-only.
