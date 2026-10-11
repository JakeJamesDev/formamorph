# Player Character Block

Status: ready-for-agent
Spec session: player-character-block — spec

## Problem Statement

The narrator reads the player in three places. The Persona chip prints the played entity as a cast-style block under a fixed `## Player Character` heading. The Stats chip prints the world's player stats under `## Player Stats`, with the played persona's own stats appended after them with no owner line. The Traits chip prints the world's player traits under `## Traits`, while the persona's own traits already sit inside its block. So a persona's traits and stats land in two different places, the heading never says who the player is, and the two side sections claim the whole player when a persona holds part of it.

## Solution

The Player Character block reads like one cast entry: a heading that names the character, then name, description, traits and stats in that order. It holds only what the persona itself owns. The world's player stats and traits keep their own sections, renamed so they read right whether a persona is played or not, and placed after the block.

With no persona, the block is gone, heading included, as any headed chip with no value already is.

## Rulings

Rulings from the discussion, numbered as asked.

- **Q1** The heading carries the character's name through the Player Name built-in: a chip header may hold `{{user}}`, and the six default persona headers become `{{user}} (Player Character)`. The built-in resolves in a header in every format. The header is line-start, so the casing concern that keeps `{{user}}` out of custom prompt bodies does not apply.
- **Q2** A persona with a blank name renders the header as written, parentheses included. Nothing collapses the text to `Player Character`.
- **Q3** The block keeps the cast entry shape: one name bullet with nested fields, exactly as the Entities chip prints a cast member.
- **Q4** The block holds the persona's own traits, then its own stats, nested as the Entities chip nests an entity's. The world's player stats and traits never enter the block.
- **Q5** The Stats and Traits chips stay in every default prompt. Their default headers become `Other Stats` and `Other Traits`, and both chips move after the Persona chip. The played persona's stats leave the Stats chip, so it holds world stats only. This reverses Q75 of the entity-stats spec for the narration, choices and planning prompts.
- **Q6** A null persona renders nothing: no heading, no body. The headed-chip blank rule already does this, so no new code decides it.
- **Q7** The choices prompt sends the Persona chip's Summary content in place of Name, so choices still see the player's traits and stats after they leave the side sections.
- **Q8** The Persona chip gains a Stats toggle, on by default, matching the Entities chip. The off state drops the stats field from the block.
- **Q9** A persona stat whose plain name clashes with a world stat keeps the numbered key the stat request gives it, so every prompt names a stat the same way.
- **Q10** The stat request and the text pass keep their layouts. The schema's `Player Character` section, its heading and its keys are unchanged.
- **Q11** The work ships as three steps, each its own ticket and its own probe: the header, the traits fold, then the stats fold with the choices variant change.
- **Q12** Emberwatch authors its five stats on the world, not on its personas, so playing Sylvie leaves her block without stats and fills Other Stats. Moving those stats onto the personas is a content change for another effort.

## User Stories

### The heading

1. As a player, I want the narrator's notes to head my character's block with my character's name, so that the model reads the block as a person and not a label.
2. As a player, I want the heading to still say "Player Character" after the name, so that the model knows this entry is me.
3. As an author, I want `{{user}}` to work inside a chip's header text, so that I can name the player in any heading of my custom prompts.
4. As an author, I want a header with a blank Player Name to render as I wrote it, so that I notice the missing name instead of a silent fallback.
5. As an author, I want the name in a header to resolve in Simple, Markdown and XML formats alike, so that my format choice never drops it.
6. As an author, I want Request Anatomy to show the heading with the name resolved, so that the preview matches what the model receives.

### The block

7. As a player, I want my character's block to read exactly like a cast member's entry, so that the model treats me with the same shape it reads everyone else in.
8. As a player, I want my persona's own traits inside its block, so that who I am sits in one place.
9. As a player, I want my persona's own stats inside its block after its traits, so that the model reads my condition next to my identity.
10. As a player, I want a persona with no stats to show no stats field, so that the block never carries an empty label.
11. As a player, I want the block to vanish entirely when I play no persona, so that the prompt carries no empty heading.
12. As an author, I want a Stats toggle on the Persona chip, so that I can leave the persona's stats out of a prompt as I can for cast entities.
13. As an author, I want the Persona chip's Summary to list trait names on one line and keep the stats in full, so that it mirrors the Entities chip's summary.
14. As a player, I want a persona stat that shares a name with a world stat to carry the same numbered key in every prompt, so that the model never reads two stats as one.

### The side sections

15. As a player, I want the world's player stats under a section called Other Stats, placed after my character's block, so that the model reads them as the rest of what I am.
16. As a player, I want the world's player traits under Other Traits, placed after my block, so that the two sections read the same way.
17. As a player, I want Other Stats and Other Traits to read right when I play no persona, so that a world without personas loses nothing.
18. As a player, I want an empty Other Traits or Other Stats section to vanish, heading included, so that the model never reads an N/A section.
19. As an author, I want my saved custom prompts to keep their own headers and chip order, so that this change never rewrites what I wrote.
20. As an author, I want the Stats and Traits chips to stay available with their own headers, so that I can still place them where I like.

### The other prompts

21. As a player, I want the choices step to see my persona's traits and stats, so that the options still fit who I am after the fold.
22. As a player, I want the stat tracker's request unchanged, so that stat changes keep landing on the right owner.
23. As a player, I want the planner's Cast to keep labeling me "Player Character", so that the planner's player rule still fires.
24. As a player, I want the director, character pass, storyboard and opening prompts to carry the same block and sections, so that every stage reads me the same way.

### Verification

25. As the developer, I want each of the three steps probed on the default endpoint with an in-batch control, so that no step ships on one pretty output.
26. As the developer, I want the stats-fold probe to score whether the narrator still lets the player's stats shape outcomes, so that "Other" is proven not to read as someone else's.
27. As the developer, I want the name-leak and stat-tabulation checks the narration probe already scores to run on every arm, so that the fold does not regress the shipped rules.

## Implementation Decisions

### The header token

- The template renderer resolves `{{user}}` inside a chip's header text before the header is framed. The value comes from the chip values map, keyed by the built-in's token, as world prompt placeholder chips already travel. A map without the key leaves the text as written.
- Resolution runs before title-casing and escaping, so a name with a capital is left alone and an all-lowercase name is capitalized as any header word is. The XML frame slugs the resolved text into the tag name.
- A blank value substitutes the empty string. No fallback text is added.
- Request Anatomy keeps treating the header as the static frame; it shows the resolved text.

### The Persona chip

- The persona's own stats are rendered through the same owned-stat path the Entities chip uses, nested after the traits field, laid out by the persona's own stat groups. The live scene and the authored scene both pass the persona's stats to the Persona chip; the authored scene passes the Custom Persona entity's stats under the None rule.
- The Stats chip's parts drop the played entities. The world's stats alone fill it. The numbered-key helper still runs across world and played stats so the persona's keys match the stat request; only the placement changes.
- The Persona chip gains a Stats axis with the Entities chip's shape: toggle, on by default, non-null id for the off state, so every saved token keeps rendering with stats.
- Summary content lists trait names on one line and keeps the stats block, mirroring the Entities chip.

### Default prompts

- Six default prompts change: narration, choices, director, character pass, storyboard and opening. In each, the Persona chip comes first with header `{{user}} (Player Character)`, then the Traits chip as `Other Traits`, then the Stats chip as `Other Stats`.
- The choices prompt's Persona chip switches from Name to Summary content.
- The stat request prompt, the text stat pass and the planner's Cast rules are untouched.
- Each step is one prompt diff with its own probe. Step one changes only headers. Step two moves nothing but renames and reorders the Traits chip. Step three moves the persona's stats and changes the choices variant.

### Data

- No world or save field changes. Saved custom prompts are plain text and keep rendering unchanged. No export-shape change.

## Testing Decisions

A good test renders through a public seam and asserts the text the model receives, never the helper that built it. Three seams:

- **The template renderer.** A template with a `{{user}}` header renders the name in every format, a blank name renders the header text as written, a missing value leaves the token in place, and a blank chip value drops the whole headed section. Prior art: the prompt header and template tests.
- **The chip values map.** From a scene with a played persona that owns stats, the Persona chip's Markdown, Simple and XML values nest the stats after the traits; the Stats chip holds the world stats alone; a clashing name carries its numbered key in both; the off state of the new axis drops the stats field; a null persona yields the none placeholder. Prior art: the chip values, persona context and authored scene tests.
- **The default prompt text.** The six defaults carry the new headers in the new order, and the choices prompt sends Summary. Prior art: the GamePrompts persona tests.

Model behavior is proven by probe numbers, not unit tests: each step's arm against an in-batch control on the default endpoint, per the probe skill.

## Out of Scope

- Moving Emberwatch's world stats onto its personas (Q12).
- `{{user}}` inside prompt bodies. The casing rule that keeps it out stands.
- The stat request's layout, keys or schema.
- The stat panel and any other UI surface. This effort changes prompt text only.
- Rewriting saved custom prompts to the new headers.

## Further Notes

- The headed-chip blank rule means `## Other Traits` disappears on a world with no player traits, as Emberwatch shows. That is the intended shape, not a gap.
- Mock renders of the target shape from the bundled worlds were produced during the discussion and live only in `.scratch/`; the tests above replace them.
- Q75 of the entity-stats spec is reversed for the narration, choices and planning prompts and should carry a note pointing here.
