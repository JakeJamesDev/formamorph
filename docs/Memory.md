# 🧠 Story Memory

How Formamorph remembers a long story — and how you can change what it remembers.

---

## Why memory exists

An AI model can only hold so much text at once. A story that runs 50 turns doesn't fit, so something has to give. Formamorph's answer is to keep the **recent** turns word-for-word and carry **older** turns as short memories instead.

| Layer | What it is |
|---|---|
| 🔍 **Recent turns** | The last few turns, sent exactly as written. Their full prose is what keeps the story's voice consistent. |
| 📌 **Memories** | Everything older, compressed to a sentence each. The story writes these itself, one per turn. |
| 🗑️ **Let go** | Memories the story judged not worth carrying — the errand you already finished, the door you already opened. |

That last step is the important one: **more memory is not better memory.** A recap stuffed with everything that ever happened crowds out the part that matters, and the story starts repeating itself. Memories are pruned deliberately.

## The Memory tab

Open the side panel's **Memory** tab during play to see the whole ledger. Faded, struck-through lines are the ones the story let go.

- 📌 **Pin** a memory to force it to stay.
- 🚫 **Forget** a memory to force it out.
- ↺ **Clear the pin** to hand the decision back to the story.

Memories under the **Recent** divider are still riding word-for-word, so your pin on one of them starts mattering only once it ages out.

## The Memory Manager

**Manage memories** opens the full editor.

| Action | What it does |
|---|---|
| ✏️ **Edit** | Rewrite a memory in your own words. Your version is always kept — the story doesn't get to drop something you wrote. |
| 🔄 **Rewrite** | Have the story summarize that turn again, if the first attempt missed the point. |
| ➕ **Add memory** | Write a memory for something that never happened in a turn: a standing fact, a promise, a detail you want carried. Yours are always kept and never judged. |
| 🗑️ **Delete** | Remove a memory. Switch the filter to **Deleted** to bring it back. |
| ↩️ **Revert** | Put an edited memory back to the story's own wording. |

Search and the filter chips — **Kept · Let go · Edited · Mine · Deleted** — make a long story's ledger navigable.

> [!TIP]
> **Nothing here is destructive.** The story's own summary is always preserved underneath whatever you write, so every change is reversible — and **Reset all my changes** puts the whole ledger back the way the story had it.

## Memories vs Notes

Both travel with the story, but they answer different questions.

| | **Memories** | **Notes** |
|---|---|---|
| Answer | *What already happened* | *What's true right now* |
| Written by | The story (you can edit) | You |
| Changes over time | Yes — they age and get pruned | No — they stay until you change them |
| Good for | A promise made, a fight won, a secret learned | Who you're pretending to be, what you're carrying, your current goal |

If the story keeps forgetting something that should always hold, that belongs in **Notes**. If it forgot something that *happened*, that's a memory — pin it, or write it yourself.

## Turning memory off

Settings → **Memory Summaries** controls whether the story writes memories at all. With it off, the oldest turns simply drop away as the story outgrows its context, and nothing is carried forward in their place.

Memories you wrote by hand still ride even with the setting off — they're yours, not the story's.
