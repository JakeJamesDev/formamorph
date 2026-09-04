# Spec: Strengthen the AI Language directive

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

Players set the AI Language setting to a non-English language (or a style like "pirate speak") and the game keeps narrating in English. The setting is wired end-to-end, but the instruction it produces is a single non-imperative label line ("Narration language: French") that can end up buried mid-prompt when lore is appended after it, and small models routinely ignore it. Additionally, clearing the language field persists an empty string, which injects dangling "Narration language: " / "Choice language: " lines and wrongly triggers the stat-updates English rider.

## Solution

Make the language directive an imperative sentence, guarantee it is the last line of the narration system prompt, and treat a blank or whitespace-only language value as English everywhere the setting is read. The setting then does the most a prompt can do to steer output language; remaining non-compliance is measurable model behavior, quantified by the probe run that ships with the change.

## User Stories

1. As a player, I want to set the AI Language to French and have narration written in French, so that I can play in my own language.
2. As a player, I want choices written in the same language as narration, so that the turn reads as one coherent surface.
3. As a player, I want the opening turn to already honor my language setting, so that the story doesn't start in English and drag later turns back to it.
4. As a player, I want a style value like "pirate speak" to shape the prose, so that the field works as the language-or-style control it advertises.
5. As a player, I want clearing the language field to behave exactly like English, so that "no value" is a safe reset and not a broken state.
6. As a player who cleared the field in an older build, I want the persisted empty value healed on read, so that I don't have to know to re-select English.
7. As a player, I want stat updates to keep parsing correctly regardless of my language choice, so that gameplay numbers never break in a non-English playthrough.
8. As a player using a small local model, I want the language instruction placed and phrased where the model actually obeys it, so that the setting works on the models the game targets, not just large ones.
9. As a world author, I want the language directive appended outside my authored prompt text, so that my prompt presets don't have to mention language themselves.
10. As a developer, I want one shared definition of "counts as English", so that narration, choices, and stat updates can never disagree about when the directive fires.
11. As a developer, I want probe numbers comparing old and new directive wording on both reference tiers, so that the change ships with evidence rather than one pretty completion.
12. As a support-giver reading reports, I want to distinguish "prompt ignored" from "model can't write that language", so that future reports can be triaged as model issues with confidence.

## Implementation Decisions

- The narration directive becomes an imperative sentence naming the target ("Write all narration in French.") instead of the bare "Narration language:" label, per the prompt-writing guide's positive-contract rule. The choices directive gets the same treatment ("Write all choices in French.").
- The wording must read correctly for style values as well as language names ("Write all narration in pirate speak.") — the field passes any value verbatim by design.
- The narration directive is appended after every other append (including the backward-compat lore block), so it is always the final line of the system prompt.
- A shared normalization helper decides whether a language value fires the directive: blank, whitespace-only, and any casing of "english" all count as English and emit nothing. All three consumers (narration, choices, stat updates) use it.
- The guard is read-side only: the settings write-sites and persistence are untouched, so already-persisted empty values are healed without migration.
- The stat-updates pass keeps its existing behavior of forcing English output (its parsing contract), but its rider now fires only for a genuinely non-English value, never for blank.
- No new settings, no UI changes, no export-shape changes.

## Testing Decisions

- Tests assert only external behavior: the returned system-prompt string from the pure prompt builders — never internal helper calls.
- Both existing seams are reused, with no new seams: the narration prompt builder's unit tests and the turn-pass builder harness (both already assert the current language lines; those assertions update to the new wording).
- New assertions: imperative wording; the narration directive is the final line even when the backward-compat lore append is active; blank / whitespace / mixed-case "English" values emit no directive in any of the three passes; the stat-updates English rider fires for "French" but not for "".
- Because this changes prompt text, the change ships with probe evidence per the prompt-writing guide: A/B (current label line vs. imperative final line) on both current reference tiers, metric = fraction of runs whose narration and choices are in the target language, plus a regression check on the other standing metrics. The A arm doubles as the baseline that tells us how much of the reports is model non-compliance.

## Out of Scope

- Language coverage for every other AI surface: memory summaries, milestone digests, character diaries, discovered/regenerated entity text, time-passed, and the staged-thinking passes (director/character/storyboard). These stay English-only; extending them is a separate product decision.
- UI changes to the language field (both write-sites keep storing whatever the player picked, including clearing to empty).
- Localizing the game's own UI chrome.
- Settings copy changes — the current description already scopes the promise to narration and choices.

## Further Notes

- The reports may still partially reflect model limits (a 12B model may simply write poor French). The probe's A arm quantifies that before any wording claim is made.
- If the probe shows even the strengthened directive is ignored on the average tier, the next lever is echoing the language in the per-turn user message rather than only the system prompt — deliberately not part of this spec.
