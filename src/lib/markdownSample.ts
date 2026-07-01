/**
 * A rich GitHub-flavored Markdown document used by the `/markdown test` command to preview the
 * narration renderer (MarkdownRenderer) on every element it maps. In-world flavored so it reads naturally.
 */
export const MARKDOWN_SAMPLE = `## The Drowned Archive

You descend the spiral stair into a vault of **salt-stained shelves** and *flickering* lecterns. The air tastes of brine and old vellum. Something down here is still ~~breathing~~ *waiting*.

> "Not all that is shelved is dead," the curator whispers. "Some books simply sleep."

### Points of interest

- The **Reliquary** — a sealed case humming with cold light
  - a cracked lens resting on velvet
  - a key shaped like a tooth
- The **Cartographer's Desk**, maps curling at the edges
- A collapsed archway leading *deeper* than the lantern reaches

### Your satchel

| Item            | Qty | Notes                                  |
| --------------- | --: | -------------------------------------- |
| Brass lantern   |   1 | half a flask of oil left               |
| Salt-soaked map |   1 | marks an unlit corridor to the **east** |
| Tooth-key       |   1 | warm to the touch                      |
| Gold marks      |  37 | clinking softly                        |

### What you might do next

1. Pry open the Reliquary with the tooth-key
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

---

The lantern gutters. Whatever you choose, choose *soon* — and read more at [the index](https://example.com).`;
