# 12 — Opening tab

**What to build:** What a fresh game as the lens PC actually looks like. A pure view-model
assembles: every stat at its starting value with its active descriptor, each with a value slider
that scrubs the range and live-updates which descriptor the AI would be told (the banding
instrument); the active traits (defaults plus the lens PC) with their pins and stat toggles applied;
placeholder rolls with each value's real probability from its weights, a reroll action, and the
unique-collision odds where several unique chips share a pool; a ~token total; and an expandable
assembled-first-prompt section showing what the model receives on turn one. Scrubbing a slider is
lens-local — it never edits the world.

**Blocked by:** 10 — Lens bar.

Status: done

- [x] Active descriptor correct at the starting value and at every slider position (band edges included)
- [x] The starting-value-vs-descriptor contradiction class is visible at a glance
- [x] Roll probabilities match the weights math; reroll re-rolls only unpinned placeholders
- [x] First prompt matches the authored-preview assembly for the same PC
- [x] Slider scrubbing leaves the world untouched (no dirty flag)

**Notes:** stats settle through the game's own `traitRuntime` seeding/acquisition, so starting
values are the *real* fresh-game numbers — trait starting deltas applied, clamps allowed to bite,
bounds derived — and the banding runs against the derived range. The descriptor lookup was extracted
to `statContext.activeDescriptor` and is now the single source for the prompt builder, the stat
rules and the sliders. Rolls prime over `rules.chipBearingTexts` (the session's priming-field
mirror); pins come from *all* active traits (defaults included), not just the lens PC, because a
default trait's pin binds every fresh game. Unique-collision odds are exact (`1 − n!·eₙ(p)`).
The first prompt = `buildNarrationPrompt` over `authoredPreviewValues` (which gained an options
bag), with the shipped default prompts/settings standing in for the global ones (ticket 11's
precedent) and `<NOTES>`/`<TIME>` as the uniform none. Opening always inspects the starting
location (`startPool` names the random pool when several are flagged); the lens location is
AI Context's concern.
