/**
 * A rich Markdown document used by the `/markdown test` command to preview the narration renderer
 * (MarkdownRenderer) on every element it maps: the full `#`–`######` heading ladder, emphasis, sub/sup in
 * both Markdown and HTML form, nested lists and blockquotes, tables with each alignment, task lists, code,
 * images, links and autolinks, escapes, and soft line breaks. In-world flavored so it reads naturally rather
 * than as a spec dump — the point is to see it as a player would.
 *
 * Keep it exhaustive: anything renderable that isn't here won't get eyes on it before a release. Footnotes
 * are the one deliberate omission — a `[^ref]` renders literally when text streams in, because the reference
 * arrives before its definition and Streamdown won't re-parse that block. They render fine in the static
 * panels (help, readme, changelog), so this sample would misreport them as broken.
 */
export const MARKDOWN_SAMPLE = `# The Drowned Archive

You descend the spiral stair into a vault of **salt-stained shelves** and *flickering* lecterns. The air tastes of brine and old vellum. Something down here is still ~~breathing~~ *waiting*, and the ledger by the door insists the whole place is ***perfectly ordinary***.

> "Not all that is shelved is dead," the curator whispers. "Some books simply sleep."
>
> > "And some," adds a voice from deeper in, "are only pretending."
> >
> > > You do not find the third speaker.

## Points of interest

- The **Reliquary** — a sealed case humming with cold light
  - a cracked lens resting on velvet
    - beneath it, a pressed flower that has not browned
  - a key shaped like a tooth
- The **Cartographer's Desk**, maps curling at the edges
- A collapsed archway leading *deeper* than the lantern reaches

### The water table

Brine has crept up the lowest shelves. The curator's gauge reads H~2~O well past the safe mark, and the pressure note beside it is worse: 3×10^4^ pascals against the far wall. Someone has scrawled a correction in HTML-neat lettering — H<sub>2</sub>O at 10<sup>5</sup> — as if precision might hold the sea back.

#### Shelf 4, submerged

The labels here have run. You can still make out a catalog depth nobody bothered to finish:

##### Sub-shelf 4b

###### Fragment 4b-i

A single page, face down, refusing to be turned.

## Your satchel

| Item            | Qty | Notes                                   |
| :-------------- | :-: | --------------------------------------: |
| Brass lantern   |  1  | half a flask of oil left                |
| Salt-soaked map |  1  | marks an unlit corridor to the **east** |
| Tooth-key       |  1  | warm to the touch                       |
| Gold marks      | 37  | clinking softly                         |

## What you might do next

1. Pry open the Reliquary with the tooth-key
   1. first, wedge the cracked lens under the lid
   2. then speak the word aloud
2. Read the curator's notes aloud
3. Follow the corridor marked on the map

You recall the curator's checklist, half-completed:

- [x] Light the lanterns
- [x] Find the tooth-key
- [ ] Open the Reliquary
- [ ] Wake the sleeping book

If you inspect the desk, you find a scrap of code etched into the wood — a counting charm:

\`\`\`js
let wards = 0;
for (const shelf of archive) {
  if (shelf.sealed) wards += 1;
}
return wards; // how many seals remain
\`\`\`

A margin note reads: press \`the tooth-key\` to the lock, then speak the word **"unmake"**.

The curator's seal is stamped below, still bright:

![the archive's seal](./icon.png)

Her final instruction is written across two cramped lines, with no room left between them:
*Do not read past the fold.*
*Do not let it read you.*

She has also, unhelpfully, noted that the ward costs 5 \\* 3 marks to renew and that \\*emphasis\\* of any kind offends it.

---

The lantern gutters. Whatever you choose, choose *soon* — read the index at [the archive's catalog](https://example.com), or petition the registry directly at https://example.com/registry.`;
