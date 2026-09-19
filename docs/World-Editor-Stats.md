# 📊 World Editor: Stats

> 🛠️ Part of the [World Editor](WorldEditor) guide.

The numbers that describe your player — health, coin, reputation, whatever your world needs. Each stat holds a value between a **Min** and a **Max**, and the AI sees them on every turn.

## Why it exists

Prose alone drifts. A stat is a fact the AI has to write around: it can't narrate you sprinting across a rooftop while your Stamina reads 4/100 without the number contradicting it.

The narrator is explicitly told to let stats shape *how an action turns out* — a low stat as effort and cost, a high one as ease — and **not** to tabulate them or report their changes. A separate step handles the actual numbers. So stats steer the story without it reading like a character sheet.

## What the AI sees

Each stat's **Name** is always sent. The Stats chip in your prompt decides what accompanies it:

| Piece | Adds |
|---|---|
| **Values** | The current value and its ceiling — `62/100`, or `62%` for a percentage stat |
| **Status** | The matching Stat Descriptor — a word for the current level |
| **Meaning** | The stat's **Description** — what it represents |

With no piece selected, the line is just the stat's name.

> ⚠️ Every stat is sent on **every turn**. Stats are one of the steadiest drains on your context budget — three meaningful stats beat a dozen decorative ones.

## The fields

| Field | What it does |
|---|---|
| **Name** | Also how the AI refers to the stat, and how stat changes are matched back to it. |
| **Type** | **Number** (a range you set) or **Percentage** (pinned 0–100, shown everywhere as `N%`). Everything below works the same for both. (List exists in the data format but isn't currently offered.) |
| **Description** | What the stat represents. Sent to the AI when the chip's **Meaning** piece is on. Takes placeholder chips. |
| **Min** / **Max** | The range. Values are always clamped to it. A percentage stat locks these at 0 / 100 and hides Max — you set only its **Initial Value (%)**. |
| **Initial Value** | Where the stat starts. Ignored when the stat has code. |
| **Regen** | Added to the value once per turn, then clamped. Positive heals over time; negative bleeds. |
| **Body Sliders** | Bind body morph sliders to this stat — its value, from Min to Max, drives each slider. Each slider belongs to only one stat. |

## Stat Descriptors

Descriptors turn a number into a word — `Winded`, `Exhausted` — which is what the AI receives when the chip's **Status** piece is on. A descriptor takes placeholder chips too, so a band can name the rolled town or the rolled rival.

Each has a **threshold** and a **Description**. A coverage bar above the rows draws every band's real extent across Min→Max, marks where the stat starts, and shows the range above your top band in red — the range where the AI is told no status at all. Each row says what it covers underneath it.

> ⚠️ **A threshold is the *top* of its band, and the lowest band the value fits in wins.** Descriptors are read low to high whatever order you list them in, so `30 → Barren` covers Min–30 and a `60` above it covers everything up to 60. Give your highest descriptor a threshold of your **Max**, or a value above it gets no descriptor at all.

**Thresholds in: Raw | % of Max**

| Setting | A threshold of `3` on a 0–10 stat means | Raise Max to 20 and… |
|---|---|---|
| **Raw** (default) | the value 3 | the band still ends at 3 |
| **% of Max** | 3% of the way from Min to Max — the value 0.3 | the band rescales to 0.6 |

Pick **Raw** for counters ("3 rockets is low") and **% of Max** for proportions ("the bottom 30% is low"). Switching converts your existing numbers, so no band moves at the moment you switch — the choice only decides what happens the next time you change the range. A **Percentage** stat is pinned to 0–100, where both readings are the same number, so it has no switch.

## Prevent AI Changes

Four checkboxes stop the AI moving a stat in one direction, while your world's own rules still can:

| Checkbox | Blocks |
|---|---|
| **Don't Increase** | AI raising the value |
| **Don't Decrease** | AI lowering the value |
| **Don't Increase Max** | AI raising the ceiling |
| **Don't Decrease Max** | AI lowering the ceiling |

Percentage stats show only the first two — their ceiling is pinned at 100, so the AI can never move it.

## Dynamic Value Calculation

A stat can compute itself from the others. Write JavaScript that **returns a number**, and it recalculates each turn instead of using Initial Value. **Test Code** runs it immediately and shows the result or the error.

Your code reads a copy of every stat and the story clock from an isolated sandbox — no page, no network, no other stat's code. The editor suggests what's in reach as you type and underlines what isn't.

**A calculated stat ignores the AI.** Its value is recomputed every turn, so anything the AI writes is overwritten. The AI still *reads* the value and description normally.

> 📘 Full reference: [Stat Code Guide](StatCodeGuide).

## Getting started

Start with two or three stats the story would genuinely turn on, each with a Min, Max and a couple of descriptors. Add Regen, locks and code only when a stat needs behavior the AI shouldn't be inventing.
