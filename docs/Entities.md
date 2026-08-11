# 🎭 Entities in Play

Who the story knows is standing in front of you — the cast you authored, plus the ones the story invents as it goes.

> Authoring a world's cast is the [World Editor](WorldEditor)'s job. This page is about the same characters at **runtime**: who the story counts as present, and what it does with a character it made up itself.

---

## Two Kinds of Character

| | **Authored** | **Story-invented** |
|---|---|---|
| Where they come from | You wrote them in the World Editor | The story made them up mid-scene |
| Live in | The world — every playthrough gets them | This playthrough only |
| Editable | Yes, in the World Editor | Not authored; removable during play |
| Survive a new game | Yes | No |

Both appear in the **Entities** panel during play, and both count the same way when the story works out who is present and what you can do next.

## Characters the Story Invents

Ask a shopkeeper for directions and the story might answer with a name you never wrote. That character used to exist only in the prose — no entry anywhere, absent from the list of who's present, never considered when the story offered you choices. Now the game reads names straight out of the narration, so an invented character joins the scene the moment they're named.

This costs nothing and is always on. It works in every Thinking mode, including plain narration with no planning at all.

> [!NOTE]
> Not every capitalized name becomes a character. A talent agency, a café, a weekday and a song title all *look* like names. The game only adds someone who behaves like a person in the prose — speaks, gestures, or is introduced — and a name that just recurs without ever doing something is left alone.

Two things identify a person outright, without waiting for them to come up again:

| Signal | Example |
|---|---|
| A **title** | *"**Doctor** Chen sets down the chart."* |
| Owning a **body or an expression** | *"**Lyria's** hand is warm as it closes around yours."* |

Only a person has a hand, a voice, a gaze or a face, so one of those is enough on its own. A place or an object with a possessive — *Teldorill's markets*, *the inn's roof* — is not a character and is skipped.

### Being Shown vs Being Mentioned

Someone your companion merely *talks about* — an absent neighbour, a baker who works in the back — is not added to your cast. A character has to appear in the story's own narration, not only inside someone's quoted dialogue.

That keeps your Entities panel to the people actually in the room with you.

## Descriptions

Settings → **Output** → **Characters** → **Describe New Characters**

Turn this on and each invented character also gets a written description, so you can open them from the Entities panel and read who they are, the same as an authored character.

| | Setting off *(default)* | Setting on |
|---|---|---|
| Appears in the Entities panel | ✅ | ✅ |
| Counted as present in the scene | ✅ | ✅ |
| Considered when offering you choices | ✅ | ✅ |
| Has a description you can open | ❌ | ✅ |
| Costs a request | Never | One, the first time each new character is named |

Everything except the description is free, which is why only the description is a setting. If you already had **Character Diaries** on, this is on for you already.

## Removing One

Because names come out of the prose, now and then the story capitalizes something that isn't a person and it gets added anyway.

Open the **Entities** panel, find the entry, and use the remove button beside it. You'll be asked to confirm.

Removing a story-invented character:

- takes them out of the current scene
- **remembers the decision**, so the same name isn't picked up again later in this playthrough
- leaves the story's text untouched — the prose still says what it said

Authored characters have no remove button. They belong to the world, and the World Editor is where they change.

> [!TIP]
> Removing is per-playthrough and travels with your save. Starting a new game gives you a clean slate.

## When It's Quiet

Some AI models rarely name anyone, writing characters as *"she"* and *"the woman in the white coat"* for a whole scene. Nothing is wrong when that happens — there is simply no name to catch. If your Entities panel stays sparse while the prose is full of people, that's the model's style rather than a setting you've missed.

Characters written with **names** get picked up. Characters written with **pronouns** can't be.

## Related

- [🧠 Story Memory](Memory) — how the story remembers what those characters did
- [🛠️ World Editor](WorldEditor) — authoring the cast that ships with your world, including its own **Entities** section
