# Image Prompt Presets And Scene Pictures Through The Writer

Status: proposal (draft by littleme02, for review)

## Problem Statement

Picture prompts are written one way, for one kind of image model, from too little:

- **Only booru tags.** The tag prompt writes comma-separated tags, which suits anime models (Illustrious, Pony, NoobAI). Models that read plain sentences (Z-Image, Flux, Chroma) draw better from a written paragraph, and there is no way to write one.
- **A portrait's writer sees too little.** Its tags come from the description alone: not where the character is now, not the story so far, not a direction for this picture.
- **A scene's people are only their authored tags.** The scene tag line stacks three parts: the location's authored tags and the present characters' authored Image Tags, both verbatim, then action tags the model writes from the turn's narration. That keeps a world's look consistent, which is a real strength. But a character with no Image Tags (every character the story invents, and most world entities) reaches the picture with no looks at all, the action writer never learns who looks like what, and a scene holds at most two people.
- **The player can't steer one picture.** There is no direction for this picture only ("by the hot spring at dusk"), no style choice per picture, and no way to choose what the writer reads.
- **No endpoint choice.** The tag writer sends to the active text endpoint. A player who uses a cheap model for small jobs can't route it there.
- **A picture blocks play.** A scene picture holds the turn until it is drawn. With a remote text model and a local image model, there is no reason to wait.

## Solution

### Image prompt presets

An **image prompt preset** (Settings → Endpoints → Image Prompts) is how a picture's prompt is written. Each preset is **one prompt**, sent to the text model as its whole message, with no system message. Every preset uses the same chips, and each chip drops out with its lead-in when empty:

- **Subject** (what kind of picture), **Subject Card** (name, pronouns, description, and the sheet where there is one), **Subject Names**.
- **Entity Location** (where the subject is) and **Scene Location** (where the player is). A preset picks one. The game is a free-form story, not a rule set: a picture of a character at their own place doesn't need a turn moving them there first.
- **Recent Prose** (the last N turns), **Direction** (this picture's own instruction) and **Style**.

Presets differ only in their text and in what they write back: **Writes: Tags** (the booru cleanup and a tag box) or **Writes: Text** (kept as written, in a text box). Two presets ship: **Booru Tags**, which writes like today's tag prompt, and **Natural Language**.

Each preset has two prompts: **Portrait** (one subject and its card) and **Scene** (a card for everyone in the picture). Each preset has its own text **endpoint** (empty = the active one).

Each image endpoint preset names the prompt preset it uses, so switching from an Illustrious endpoint to a Z-Image one switches how prompts are written.

**Names.** An option, **Replace names with Person A, B, C**, sends the people in the picture as Person A, B, C instead of by name, in their cards and in the recent prose. It is on by default for Booru Tags. It can't catch a nickname that isn't an alias, so it is a choice. With it off, the prompt tells the writer to leave names out, which works with most models.

### Styles

A **style** is a named look in words, such as "watercolor, soft light". The writer interprets it as tags or as a sentence. Each image endpoint preset has a **Default Style** (or none), and every place that draws a picture can pick another.

### The Generate window

Generating a portrait gets a **Direction** box and a **Style** picker. In a game it also gets ticks for what the writer reads: **Write from where they are**, **Write from the recent story**, and the subject's sheet. Then comes **Write**, with a page icon showing **what the writer is given**, and the prompt it writes. A portrait from a game can show a character where they are now, not only at their starting place.

### Scene pictures

A scene picture uses the same writer with the preset's **Scene** prompt. It gets a card for everyone in the picture, their Image Tags included, plus where it happens, the recent prose ending on this turn, the in-frame names (so people only mentioned stay out), the direction and the style. The cast starts as the turn's present entities (and the persona when in frame).

Each turn gets an **Image Gen** button that opens its picture pane. The pane has the preset, the cast (add or remove anyone), Direction, Style, Write, Draw, and a page icon for what the writer is given. A red × closes it. A closed pane still shows progress and Stop.

### Keep Playing While It Draws

A Display setting, **Keep Playing While It Draws**, **off by default**. With it on, a turn-end picture no longer holds the turn: pictures draw one after another in the background, each landing on its own turn, and Write and Draw run during a turn. Off keeps today's wait, which is right for one graphics card running both the text and the image model.

## User Stories

1. As a player with a natural-language image model, I want prompts written as sentences, so that Z-Image, Flux and Chroma draw what the story describes.
2. As a player with an anime model, I want booru prompts written from the character card, the story and my direction, so that tags carry more than the description.
3. As a player, I want the image endpoint to choose how its prompts are written, so that switching models doesn't mean rewriting prompts.
4. As a player, I want one prompt per preset, with the same chips for every kind, so that tag and sentence presets work the same way.
5. As a player, I want a separate prompt for portraits and scenes, so that a scene can describe several people and what they do.
6. As a player, I want the scene writer to get a card for everyone in the picture, so that each person's looks stay with that person.
7. As a player, I want to add and remove people from a scene picture, so that I choose who is drawn.
8. As a player, I want to draw a character where they are now, or where the scene is, so that a picture can follow the story without moving them there in a turn.
9. As a player, I want a direction for one picture, so that I can ask for "at the hot spring at dusk" without changing any prompt.
10. As a player, I want named styles, a default per endpoint and a choice per picture, so that a game keeps one look and a picture can try another.
11. As a player, I want ticks for what the writer reads, so that a portrait need not carry the story.
12. As a player, I want to see exactly what the writer is given, so that I can fix a bad prompt at its source.
13. As a player, I want each prompt preset to pick its endpoint, so that a cheap model can write tags while a strong one writes prose.
14. As a player, I want names kept out of picture prompts, so that the image model doesn't draw a name or mix people up.
15. As a player with remote text models, I want to keep playing while a picture draws, so that a slow picture doesn't stop the story.
16. As a player with one graphics card, I want the wait kept as the default, so that the text and image models don't fight for memory.

## Implementation Decisions

Decisions from building and playing with the working version:

- **D1** No difference between tag and sentence presets beyond their text and what they write back. Both get every chip, Direction included; both are one prompt.
- **D2** One prompt box, not a system and a user prompt: chips that are empty drop out with their lead-in, so one text covers every case. No system message is sent when there is none.
- **D3** Portrait and Scene are separate prompts on each preset.
- **D4** Every preset goes through the writer, scenes included. The three-part scene composer is retired in my fork.
- **D5** Cards carry each person's Image Tags, so a tag preset keeps the tags a player wrote.
- **D6** The endpoint is chosen per prompt preset, in Settings → Endpoints → Image Prompts.
- **D7** What the writer reads (place, recent story, sheet) is ticked per picture.
- **D8** Replace names with Person A, B, C is an option, on for Booru Tags.
- **D9** The picture pane opens from a turn's Image Gen button, always fully shown, closed with a red ×. There is no separate Hide Tags button.
- **D10** Keep Playing While It Draws ships off.

Open for your rulings:

- **Q1** The Scene Tags prompt tab: retire it, or keep it as the Booru Tags preset's Scene prompt?
- **Q2** Should the scene writer's request show in the AI Context viewer? Through the preset's own endpoint it currently doesn't; routing it through the game request path would show it but lose the per-preset endpoint.
- **Q3** Does this fit the image visibility rules and gallery objects: should a written prompt be stored on the gallery image it drew?
- **Q4** Should the shipped Natural Language preset name model families (Z-Image, Flux, Chroma) in its description, or stay generic?
- **Q5** The composer keeps authored tags verbatim, so a world's look never drifts. The writer is told to use each person's Image Tags as they are, but a model can still reword them. Should a tag preset append authored tags verbatim after the writer's line, keeping both the consistency and the written scene?
- **Q6** The composer caps a scene at two people because booru models lose track past two. Should tag presets keep that cap, while text presets take everyone in frame?

## Testing Decisions

- Unit: the preset store (seeds, reading older shapes, a missing seed put back); each chip and its lead-in dropping out when empty; Person A, B, C in cards and prose; tag cleanup only for Writes: Tags; the scene writer's message for two people with Image Tags; styles and the Default Style.
- e2e (mocked endpoints and ComfyUI): Write in the Generate window sends the preset's prompt to its endpoint; a scene picture's writer gets the Scene prompt with where it happens; with Keep Playing While It Draws on, the next turn goes while the picture is still drawing, and the picture lands on its own turn.

## Out of Scope

- **One-press model setups.** My fork has buttons that set up ComfyUI workflows for Z-Image Turbo, Flux 2 Klein and Chroma, but they name my own model files and are basic workflows. Upstream could get a guide section instead: export ComfyUI's own template for the model in API format, swap in `%prompt%`, `%width%`, `%height%` and `%seed%`, and pick a Text prompt preset.
- **Which model is best.** In my testing an Illustrious model (waiIllustrious) drew a centaur correctly five times out of five, while the natural-language models I tried failed it. Booru prompts are not second-class here: the biggest gain for them is that they are now written from the card, the story and the direction.

## Further Notes

A working version runs in my fork (`ultra` branch). It is large, so as PRs I'd split it, each part standalone and unchanged in behaviour by default:

1. **ComfyUI fixes** (small): an empty Model uses the first checkpoint the server lists (today it sends an empty name and fails); the Model row shows the workflow's own model when the workflow has no `%ckpt%`; a `%prefix%` token with a **File Name** pattern such as `formamorph/{world}/{subject}`.
2. **Image prompt presets**: one prompt, chips, Writes: Tags or Text, per-preset endpoint, what the writer is given. The default Booru Tags preset behaves like today's tag prompt.
3. **Styles.**
4. **Scene pictures through the writer**, with the picture pane.
5. **Keep Playing While It Draws**, off by default.
