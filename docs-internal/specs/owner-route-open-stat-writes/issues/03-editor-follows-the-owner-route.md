# 03: Editor Follows The Owner Route

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Pattern work across completion, diagnostics, and the surface tables, with existing tests to follow. Sonnet at high effort.

## What to build

The code editor matches the runtime from tickets 01 and 02.

- Completion: `owner.` lists the entry fields; `owner.stats.` lists the owner's stats; `stats.` lists the world stats in every box. In a world-stat box, `owner` completes as an empty entry.
- Diagnostics: the read-only underline on `entities[x].stats.<Name>.<field>` and `persona.stats.<Name>.<field>` goes for the four writable fields. An unknown stat name is underlined on every route.
- Self detection follows the owner. In an owned box, `owner.stats.<own name>` is the running stat. The "write to `self` instead" hint and the missing-return check use that path.
- The missing-name check knows `owner` as a root.
- The stat-code surface tables gain `owner` and lose the read-only wording on `stats`.

## Acceptance criteria

- [ ] Completions after `owner.`, `owner.stats.`, and `stats.` list the right names in an owned box and a world box
- [ ] A write through `entities[x].stats` or `persona.stats` to a writable field raises no warning; a read-only field still does
- [ ] An unknown stat name is underlined after `stats`, `owner.stats`, `entities[x].stats`, and `persona.stats`
- [ ] In an owned box, `owner.stats.<own name>.value = n` gets the `self` hint and satisfies the missing-return check; `stats.<own name>` does not
- [ ] The analysis seam proves each guard by reinstating the old read-only underline once
- [ ] Four gates green

## Blocked by

- 02 (Code Writes Any Stat)
