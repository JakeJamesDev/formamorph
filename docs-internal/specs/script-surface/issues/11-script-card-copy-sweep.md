# 11: Script Card Copy Sweep

Status: ready-for-agent
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: a voice and format pass over settled copy, with the copy-sweep skill as the checklist.

## What to build

Every hover card and Variable menu line a script or Tool script can show reads in the help voice: the globals, every map entry and its fields, the verbs, the clock, narration and player fields, the built-ins, and the Tool-only `args` and `console`. Run the copy-sweep skill over the whole script surface and the user Tool surface, not only the lines this effort added: new lines wrote in a voice that older lines may not match, and the sweep makes them one set. Fix drift in place: verb-first, second person, contractions, no on/off preamble, American English, entity never character, defined terms bold with their element type on first mention, one sentence with no period or two or more with periods. Access badges and the Allowed Values rows stay as they are.

Spec: Further Notes; writing guide.

## Acceptance criteria

- [ ] A sweep report lists every card line of both surfaces with its verdict, kept or changed, stored at `.scratch/frames/card-copy-sweep.md` in the worktree
- [ ] No card line opens with "This", "The script", "Returns" or "Whether", and no line has a trailing period on a one-sentence card; a test over the surface tables asserts it
- [ ] Every entry field of `locations`, `memories`, `dictionaries.X.entries` and the new entity members reads as one sentence under 20 words
- [ ] The Variable menu's group info lines match their card lines
- [ ] Four gates green

For you: open a script box and hover `memories[0].pinned`, `location.present` and `entities.Mira.following`; the three lines should read as one voice.

## Blocked by

- 01 (Locations Map And Entity Place)
- 02 (Diary On Entities And The Rewrite Pass)
- 03 (Memories Reads)
- 04 (Trait Switch Landing)
- 05 (Memory Verdicts)
- 06 (Dictionary Entries)
- 07 (Array Elements In Cards And Tree)
- 08 (User Tool Convergence)
- 09 (User Tool Text Migration)
