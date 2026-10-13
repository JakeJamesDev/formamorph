# Small Things From My Fork

These are built and in daily use in my fork (`ultra` branch). Each is small and stands alone. Pick any you want and I'll send it as its own PR, rebased on main. The specs I've sent refer to a few of them by name.

## The turn line and the turn editor

**The problem:** the clock ran on its own. With Measured Clock off, each turn still cost a flat hour, so a scene of a few turns ran days ahead. There was no way to set the time by hand, and no sign of what a turn had changed.

**What it does:** a line under each turn shows what that turn changed: time passed and the resulting clock, stat changes, a move. It's read from the saved state before and after the turn, not written by the AI. The latest turn's line opens an editor:
- **Time:** typed as `30m`, `2h`, `1d`, or a clock time (`14:24`, or `1203` for 12:03, which shows the span it works out to).
- **A per-turn exact flag**, since some turns need minutes and others just "later".
- **Stat changes:** edit them, add one, or drop one with a red ×.

Saving retakes the turn's snapshot. (Time Per Turn, already merged, was the first part of this.)

## Compare before an AI draft replaces text

**The problem:** the World Editor's generate buttons, Rewrite Note and similar overwrite what's there without showing what they wrote.

**What it does:** a window shows the draft against the current text, field by field, with **Use** and **Discard**. Filling an empty field still happens at once.

## The endpoint on hover

**The problem:** with prompts routed to different endpoints (I use one model for prose, a stronger one for reasoning-heavy passes, and a cheap one for small jobs), there's no way to see where a button's request goes.

**What it does:** every button that sends a request names its endpoint in its tooltip, e.g. "Sends to GLM 5.3 · glm-5.3": Send, re-generate, the scene actions (a line under each More menu item) and the generate buttons.

## Extra Parameters per endpoint

**The problem:** there's no way to send a vendor's own fields: a reasoning level, `chat_template_kwargs`, a routing block, `top_a`.

**What it does:** a JSON box per text endpoint (Advanced, below Sampling), merged last into every request to that endpoint. It can't replace `model`, `messages` or `stream`. Text that isn't one JSON object shows why in red and sends nothing.

## Thinking models cut off on small requests

**The problem:** a model that always thinks (Kimi K2 thinking builds, DeepSeek V4 Pro) spends a small request's whole token budget thinking. Choices, stat updates and other short passes come back cut off mid-thought, with no answer.

**What it does:**
- With the endpoint's Max Output off, a model whose thinking can't be switched off is sent without a cap. The answer cap still limits the answer.
- A model the game doesn't recognise as a thinker that gets cut off mid-thought is retried once without a cap.
- An endpoint with its own Max Output keeps it.

## ComfyUI fixes

- **An empty Model** sent an empty checkpoint name, which ComfyUI rejects. It now uses the first checkpoint the server lists, and the placeholder says which.
- **The Model row** shows the model file a workflow loads itself, greyed out, when the workflow has no `%ckpt%`. Today it shows a checkpoint that changes nothing.
- **File Name:** a pattern per image preset sets where pictures are saved under ComfyUI's output folder, with `{world}`, `{subject}`, `{turn}` and `{preset}`, through a new `%prefix%` workflow token. Default `formamorph/{world}/{subject}`, instead of every picture landing loose as `ComfyUI_000xx.png`.

## No empty system message

A request whose system prompt is empty sends no system message, rather than an empty one, which some strict endpoints reject.
