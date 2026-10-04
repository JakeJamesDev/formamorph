# 🧠 Story Memory
<!-- keywords: ai forgets, long term recall, forgetful, keeps forgetting, context limit, amnesia -->

How Formamorph remembers a long story, and how you can change what it remembers.

---

## Why Memory Exists
<!-- keywords: context window, token limit, too long, compression, pruned, repeats itself, forgot earlier events, struck through -->

An AI model can only hold so much text at once. A story that runs 50 turns doesn't fit, so something has to give. Formamorph keeps the **recent** turns word for word and carries **older** turns as short memories instead.

| Layer | What It Is |
|---|---|
| 🔍 **Recent turns** | The last few turns, sent exactly as written. Their full prose keeps the story's voice consistent. |
| 📌 **Memories** | Everything older, compressed to a sentence each. The story writes these itself, one per turn. |
| 🗑️ **Let Go** | Memories the story judged not worth carrying, such as an errand you already finished. |

**More memory is not better memory.** A recap with everything that ever happened crowds out the part that matters, and the story starts to repeat itself. The story prunes memories on purpose.

> [!NOTE]
> Most memory settings are in Settings → **Output**, in the **Memory**, **Time** and **Characters** sections. Those sections show only in **Advanced** mode. Select **Advanced** next to the **Settings** title to see them.

## How to Edit a Memory
<!-- keywords: change, fix, rewrite, summary, correct, wrong, remember, inaccurate recap, misremembered, alter, amend, pencil, revert, modify history, search for one -->
<!-- route: memoryManager -->

1. During play, open the side panel's **Memory** tab.
2. Select **Manage Memories**. The **Memories** dialog opens.
3. Find the memory. Type in **Search memories…**, or select a filter chip.
4. Select the pencil button, **Edit This Memory**.
5. Rewrite the text.
6. Select **Save**.

The story always keeps your version. To go back to the story's own words, select **Revert to the Original** on that memory.

## How to Add a Memory
<!-- keywords: remember, new, write, fact, note, summary, make ai remember, custom entry, manual, promise, backstory, insert event, teach, permanent detail, never lose -->
<!-- route: memoryManager -->

1. Open the side panel's **Memory** tab.
2. Select **Manage Memories**.
3. Select **Add Memory**.
4. Type the fact the story should carry, such as a promise or a standing detail.
5. Select **Add**.

Memories you write are always kept. The story never judges them.

## How to Pin or Forget a Memory
<!-- keywords: keep, remove, delete, lock, important, remember, drop, discard, always include, prioritize, force, irrelevant, stop mentioning, ignore, star, exclude, unpin -->
<!-- route: gameViewer.memory -->

1. Open the side panel's **Memory** tab.
2. Find the memory.
3. Select **Pin This Memory** to keep a memory the story let go. Select **Forget This Memory** to let go of a memory the story kept.
4. To give the decision back to the story, select **Clear Pin (Let the Story Decide)**.

Memories you wrote have no pin button, because the story never lets them go.

## How to Undo Your Memory Changes
<!-- keywords: reset, revert, restore, deleted, bring back, original, messed up, mistake, undelete, recover removed, start fresh, cancel edits, trash -->
<!-- route: memoryManager -->

1. Open the side panel's **Memory** tab.
2. Select **Manage Memories**.
3. Select **Reset All My Changes**.
4. Confirm in **Reset Every Memory Change?**.

To bring back one deleted memory instead, select the **Deleted** filter chip, then **Restore This Memory** on that memory.

## How to Turn Memory Off
<!-- keywords: disable, summaries, stop, faster, remove, fewer requests, speed up, no recap, save tokens, skip, switch off, cheaper, too slow -->
<!-- route: settings.output -->

1. Open **Settings**.
2. Select **Advanced** next to the title.
3. Open the **Output** tab.
4. In the **Memory** section, turn off **Memory Summaries**.

During play, the **How to Play** help has the same **Memory Summaries** checkbox on its **Memory & Notes** tab, in every mode.

## How to Date Each Memory
<!-- keywords: time, timestamp, day, calendar, clock, when it happened, how long ago, time passing, hours, chronology, time of day, elapsed, story date -->
<!-- route: settings.output -->

1. Open **Settings**.
2. Select **Advanced** next to the title.
3. Open the **Output** tab. **Memory Summaries** must be on, or the **Time** section does not show.
4. In the **Time** section, turn on **Measured Clock**.
5. Turn on **Time in Memory** if the AI should also read the dates.

## The Memory Tab
<!-- keywords: ledger, crossed out, faded lines, filters, list in sidebar, recent divider, greyed out, icons meaning -->
<!-- route: gameViewer.memory -->

Open the side panel's **Memory** tab during play to see the whole ledger. Faded, struck-through lines are the ones the story let go.

| Control | What It Does |
|---|---|
| 📌 **Pin This Memory** | Forces a let-go memory to stay. |
| 🚫 **Forget This Memory** | Forces a kept memory out. |
| ↺ **Clear Pin (Let the Story Decide)** | Gives the decision back to the story. Shows only on a pinned memory. |
| **Manage Memories** | Opens the **Memories** dialog. |

The filter chips are **All · Verbatim · Summary · Held · Custom**. **Custom** shows the memories you wrote.

Memories under the **Recent** divider still go to the AI word for word, so a pin on one of them matters only after it ages out. The divider shows under the **All** chip only.

## The Memory Manager
<!-- keywords: full editor, regenerate summary, resummarize, badges, trash, browse all, yours badge, popup, big list -->
<!-- route: memoryManager -->

**Manage Memories** opens the **Memories** dialog, the full editor. Each memory has these buttons:

| Button | What It Does |
|---|---|
| ✏️ **Edit This Memory** | Rewrite a memory in your own words. The story always keeps your version. |
| 🔄 **Have the Story Write This Memory Again** | The story summarizes that turn again. The new text carries a **Rewritten** badge. |
| 🗑️ **Delete This Memory** | Removes a memory. Select the **Deleted** chip to bring it back. |
| ↩️ **Revert to the Original** | Puts an edited memory back to the story's own words. |
| ♻️ **Restore This Memory** | Brings a deleted memory back. Shows under the **Deleted** chip. |
| 📌 **Pin This Memory**, 🚫 **Forget This Memory**, ↺ **Clear Pin (Let the Story Decide)** | The same pin buttons as the **Memory** tab. |

**Add Memory** writes a memory for something that never happened in a turn: a standing fact, a promise, a detail you want carried. Yours carry a **Yours** badge, and the story never judges them.

**Search memories…** and the filter chips find a memory in a long story. The chips are **All · Verbatim · Summary · Held · Let Go · Edited · Custom · Deleted**. **Verbatim**, **Summary** and **Held** name the *form* the story holds a memory in, and a memory is only ever one of them.

> [!TIP]
> **Nothing here is destructive.** The story's own summary is always kept under whatever you write, so you can undo every change. **Reset All My Changes** puts the whole ledger back the way the story had it.

## Kept vs Sent
<!-- keywords: accent bar, colored stripe, which ones were used, difference, relevance ranking, held meaning, verbatim meaning, scene badge, left out this turn -->

Being **kept** and being **sent** are different things.

*Kept* is a standing verdict: the story judged this memory worth carrying, or you pinned it. *Sent* is about one turn. With **Semantic Memory** on, the game ranks the kept memories against what you just did, and only the most relevant ones go to the AI. A long story keeps far more memories than any single turn sends.

| Row | Means |
|---|---|
| **Left accent bar** | Sent to the story on the last turn |
| **Plain** | Kept, but not sent this turn |
| ~~**Struck through**~~ | The story let this one go |

The three forms a memory can be in:

| Chip | The story has… |
|---|---|
| **Verbatim** | The real text: a recent turn, or one that **Scene Recall** sent back whole |
| **Summary** | The compressed line you're reading, and nothing more |
| **Held** | Nothing this turn. Still kept, until it is relevant again |

A memory that **Scene Recall** sent back as its full original prose has an accent too, and a **Scene** badge in the **Memories** dialog. The story saw the whole scene, not only the one-line summary. The **Verbatim** chip collects those and the recent turns that still go to the AI word for word.

> [!NOTE]
> Nothing is marked until a turn has run. A save you just loaded shows no accents. Memories under the **Recent** divider are never marked, because they always go to the AI word for word.

## Memory Settings
<!-- keywords: embeddings, rag, vector search, max count, limit number, defaults, configuration, diary, options list, small model download -->

All of these are in [Settings](Settings#memory) → **Output**, in **Advanced** mode.

| Setting | Section | Default | What It Does |
|---|---|---|---|
| **Memory Summaries** | Memory | On | Condenses older turns into memories. One extra request per turn. |
| **Semantic Memory** | Memory | Off | Keeps the memories most relevant to your action, not only the newest. Runs a small model on your device, a one-time download of about 23 MB. Shows when **Memory Summaries** is on. |
| **Memory Cap** | Memory | On, 12 | Sends at most this many memories each turn. The story opening and the newest memories always stay. Shows when **Semantic Memory** is on. |
| **Scene Recall** | Memory | Off | Sends a past scene word for word when your action goes back to it. At most two scenes per turn. Shows when **Semantic Memory** is on. |
| **Measured Clock** | Time | Off | Measures how much story time each turn takes. See [When Each Memory Happened](#when-each-memory-happened). |
| **Time in Memory** | Time | Off | Tells the AI when each memory happened. |
| **Character Diaries** | Characters | Off | Each entity present writes a first-person diary entry as turns age out. Its recent entries shape its motivation. Shows in the Staged Thinking mode only. |
| **Diary Recall** | Characters | Off | Adds older diary entries that are relevant to the moment. Costs nothing extra. Shows when **Character Diaries** and **Semantic Memory** are on. |

The **Time** section shows only while **Memory Summaries** is on.

**Milestone Select** is a prompt, not a setting. Between turns, it decides which summarized turns stay in long-term memory. Edit it under Settings → **Prompts** → **Milestone Select**, in **Advanced** mode. Its tab shows while **Memory Summaries** is on.

## When Each Memory Happened
<!-- keywords: day counter, wrong time of day, starts in morning, starting hour, two days ago, flat hour, relative time, time system, stamp, evening -->

With **Measured Clock** on, every memory carries its place in the story's own time:

> Day 3, evening — two days ago

Both readings sit together on purpose. *Day 3, evening* tells you where in the story you were. *Two days ago* tells you how far back that is. The AI reads the same stamp when **Time in Memory** is on.

The side panel's clock reads the same way: **Day 1, morning**, not a count of hours.

| | |
|---|---|
| **Recent Memories** | *moments ago*, *earlier today* |
| **Your Own Memories** | Stamped at the moment you added them |
| **Times of Day** | Coarse: *dawn*, *morning*, *midday*, *afternoon*, *evening*, *night*. Never a clock reading. |

> [!NOTE]
> **The Memory tab dates nothing while Measured Clock is off.** Without it every turn costs a flat hour, so a date would only be a turn count. **Time in Memory** still dates what it sends to the AI, at that flat hour. Turn Measured Clock on partway through a story, and the earlier turns are dated at that flat hour. The scale is wrong, but the order is right.

Both settings are in Settings → **Output** → **Time**, in **Advanced** mode. **Measured Clock** decides whether the game measures time. **Time in Memory** decides whether the AI is told.

### Where the Clock Starts

The clock also has to start at the right time of day. With **Measured Clock** on, the game reads your opening scene once and sets the clock to match it. A story that opens on lamps and a cold watch starts at night. One that opens on morning rounds starts in the morning.

| | |
|---|---|
| **When it runs** | Once, on the opening turn |
| **What it reads** | Your opening scene, not the world description |
| **If it can't tell** | The clock starts in the morning |
| **Existing stories** | Never re-dated. See below. |
| **Re-generating the opening** | Read again, so a new opening gets its own clock |

> [!IMPORTANT]
> **Turning Measured Clock on partway through a story does not change when that story began.** The opening scene is long gone by then, and a new start would move every stamp you already have.

Edit how it judges a scene under Settings → **Prompts** → **Opening**, next to **Clock**. The **Prompts** tab shows in **Advanced** mode, and both tabs show while **Measured Clock** is on.

## Memories vs Notes
<!-- keywords: difference, which should i use, compare, inventory, current goal, where to put, standing fact, what i am carrying -->

Both travel with the story, but they answer different questions.

| | **Memories** | **Notes** |
|---|---|---|
| Answer | *What already happened* | *What's true right now* |
| Written by | The story (you can edit) | You |
| Changes over time | Yes. They age, and the story prunes them. | No. They stay until you change them. |
| Good for | A promise made, a fight won, a secret learned | Who you're pretending to be, what you're carrying, your current goal |

If the story keeps forgetting something that should always hold, put it in **Notes**. If it forgot something that *happened*, that's a memory. Pin it, or write it yourself.

## Turning Memory Off
<!-- keywords: what happens without, consequences, old turns dropped, effect of disabling, nothing carried forward, manual ones still used -->

**Memory Summaries** controls whether the story writes memories at all. It is in Settings → **Output** → **Memory**, in **Advanced** mode. With it off, the oldest turns drop away as the story outgrows its context, and nothing carries forward in their place.

Memories you wrote by hand still go to the AI with the setting off. They're yours, not the story's.
