# Gendered Quote Colors — Stub

Status: needs-triage
Status note: follow-up to `docs-internal/specs/quote-color/spec.md`; needs a grilling session before it is a spec
Spec session: Quoted text color settings

## Idea

A quote takes a color by the speaker's gender: blue or pink, each with a light and a dark value that reads
correctly. When the gender or the speaker is unknown, the quote keeps the player's normal dialogue color.

## What exists

- The quote-color work wraps every quote in one span. A per-speaker color would set an attribute on that
  span.
- An entity has no gender, sex, or pronoun field. Gender appears only in free-text descriptions and image
  tags. The player has no character record at all.
- Nothing attributes a quote to a speaker. The narration reader strips quoted speech before it looks for
  entity names.
- The closest structured per-turn record is the director's cast list, which holds a name, stance, and
  alias per character.

## Open questions

| # | Question |
| --- | --- |
| 1 | **Gender source.** An author-set entity field, a parse of the description, or an AI call? An entity field changes the world export shape. |
| 2 | **Speaker attribution.** A text heuristic near each quote ("she said", nearest name), or a structured field from an AI call? An AI-call change needs probe evidence on both model tiers. |
| 3 | **Runtime characters.** How does a character the model invented get a gender? |
| 4 | **The player.** Where does the player's gender come from? |
| 5 | **Beyond two.** What does a nonbinary or unknown speaker show? The current answer is the normal dialogue color. |
| 6 | **Colors.** Are the blue and pink theme tokens, fixed values, or player-set? |
| 7 | **Wrong guesses.** A wrong color is worse than no color. What confidence bar leaves a quote uncolored? |
