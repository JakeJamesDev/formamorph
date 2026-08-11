# 🧠 Story Memory

How Formamorph remembers a long story — and how you can change what it remembers.

---

## Why Memory Exists

An AI model can only hold so much text at once. A story that runs 50 turns doesn't fit, so something has to give. Formamorph's answer is to keep the **recent** turns word-for-word and carry **older** turns as short memories instead.

| Layer | What It Is |
|---|---|
| 🔍 **Recent turns** | The last few turns, sent exactly as written. Their full prose is what keeps the story's voice consistent. |
| 📌 **Memories** | Everything older, compressed to a sentence each. The story writes these itself, one per turn. |
| 🗑️ **Let Go** | Memories the story judged not worth carrying — the errand you already finished, the door you already opened. |

That last step is the important one: **more memory is not better memory.** A recap stuffed with everything that ever happened crowds out the part that matters, and the story starts repeating itself. Memories are pruned deliberately.

## The Memory Tab

Open the side panel's **Memory** tab during play to see the whole ledger. Faded, struck-through lines are the ones the story let go.

- 📌 **Pin** a memory to force it to stay.
- 🚫 **Forget** a memory to force it out.
- ↺ **Clear the pin** to hand the decision back to the story.

Memories under the **Recent** divider are still riding word-for-word, so your pin on one of them starts mattering only once it ages out.

## The Memory Manager

**Manage Memories** opens the full editor.

| Action | What It Does |
|---|---|
| ✏️ **Edit** | Rewrite a memory in your own words. Your version is always kept — the story doesn't get to drop something you wrote. |
| 🔄 **Rewrite** | Have the story summarize that turn again, if the first attempt missed the point. |
| ➕ **Add Memory** | Write a memory for something that never happened in a turn: a standing fact, a promise, a detail you want carried. Yours are always kept and never judged. |
| 🗑️ **Delete** | Remove a memory. Switch the filter to **Deleted** to bring it back. |
| ↩️ **Revert** | Put an edited memory back to the story's own wording. |

Search and the filter chips — **Verbatim · Summary · Held · Let Go · Edited · Custom · Deleted** — make a long story's ledger navigable. The first three name the *form* the story holds a memory in, and no memory is ever two of them at once. The Memory tab carries a short version of the same chips.

> [!TIP]
> **Nothing here is destructive.** The story's own summary is always preserved underneath whatever you write, so every change is reversible — and **Reset All My Changes** puts the whole ledger back the way the story had it.

## Kept vs Sent

Being **kept** and being **sent** are different things.

*Kept* is a standing verdict — the story judged this memory worth carrying, or you pinned it. *Sent* is about one turn: with **Semantic Memory** on, the kept pool is ranked against what you just did, and only the most relevant handful actually rides. A long story keeps far more memories than any single turn carries.

| Row | Means |
|---|---|
| **Left accent bar** | Reached the story on the last turn |
| **Plain** | Remembered — just held back this turn |
| ~~**Struck through**~~ | The story let this one go |

The three forms a memory can be in:

| Chip | The story has… |
|---|---|
| **Verbatim** | The real text — a recent turn, or one Scene Recall brought back whole |
| **Summary** | The compressed line you're reading, and nothing more |
| **Held** | Nothing this turn. Still remembered, waiting to become relevant again |

A memory **Scene Recall** sent back as its full original prose is accented too, and tagged **Scene** in the Manager — the story saw far more than the one-line summary you're reading. The **Verbatim** filter collects those along with the recent turns still riding word-for-word: both mean the story has the real text, not a compression of it.

> [!NOTE]
> Nothing is marked until a turn has run. A freshly loaded save shows no accents rather than replaying an old turn's selection. Memories under the **Recent** divider are never marked — they ride word-for-word regardless, which the divider already tells you.

## When Each Memory Happened

With **Measured Clock** on, every memory carries its place in the story's own time:

> Day 3, evening — two days ago

Both readings sit together on purpose. *Day 3, evening* tells you where in the story you were; *two days ago* tells you how far back that is. Working out one from the other is a small tax you'd pay on every line, and the AI reads the exact same stamp for exactly this reason.

The character panel's clock reads the same way — **Day 1, morning** rather than an elapsed-hours count.

| | |
|---|---|
| **Recent Memories** | *moments ago*, *earlier today* |
| **Your Own Memories** | Stamped at the moment you anchored them |
| **Times of Day** | Coarse — *dawn*, *morning*, *midday*, *afternoon*, *evening*, *night*. Never a clock reading. |

> [!NOTE]
> **Nothing is stamped while Measured Clock is off.** Without it every turn costs a flat hour whatever happened in it, so a date would really just be a turn count wearing a costume. Switch it on partway through a story and the earlier turns are dated at that flat hour — roughly wrong in scale, but still in the right order.

Both settings live under Settings → Output → Memory. **Measured Clock** decides whether time is measured at all; **Time in Memory** decides whether the AI is told.

### Where the clock starts

Knowing how far each turn moves is only half of it — the clock also has to start in the right place. Every story used to open at eight in the morning, so a world written to begin at a midnight vigil or a supper table was wrong from its first line, and stayed wrong by the same amount forever.

With **Measured Clock** on, the game reads your opening scene once and sets the clock to match it. A story that opens on lamps and a cold watch starts at night; one that opens on morning rounds starts in the morning.

| | |
|---|---|
| **When it runs** | Once, on the opening turn, alongside the rest of it |
| **What it reads** | Your opening scene — not the world description |
| **If it can't tell** | Falls back to morning, exactly as before |
| **Existing stories** | Never re-dated — see below |
| **Re-rolling the opening** | Read again, so a rewritten opening keeps its own clock |

> [!IMPORTANT]
> **Turning Measured Clock on partway through a story does not change when that story began.** The opening scene is long gone by then, and re-dating it would move every stamp you've already collected. Stories started before this existed keep the clock they have.

Edit how it judges a scene under Settings → **Prompts** → **Opening**, next to **Clock**.

## Memories vs Notes

Both travel with the story, but they answer different questions.

| | **Memories** | **Notes** |
|---|---|---|
| Answer | *What already happened* | *What's true right now* |
| Written by | The story (you can edit) | You |
| Changes over time | Yes — they age and get pruned | No — they stay until you change them |
| Good for | A promise made, a fight won, a secret learned | Who you're pretending to be, what you're carrying, your current goal |

If the story keeps forgetting something that should always hold, that belongs in **Notes**. If it forgot something that *happened*, that's a memory — pin it, or write it yourself.

## Turning Memory Off

Settings → **Memory Summaries** controls whether the story writes memories at all. With it off, the oldest turns simply drop away as the story outgrows its context, and nothing is carried forward in their place.

Memories you wrote by hand still ride even with the setting off — they're yours, not the story's.
