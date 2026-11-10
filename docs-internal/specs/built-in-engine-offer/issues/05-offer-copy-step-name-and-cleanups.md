# 05: Offer Copy, Step Name and Cleanups

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Model rationale: two copy strings and a rename, plus four behavior-neutral refactors across the desktop shell and the game view.

**What to build:** the follow-ups the user chose after the close review (Q15–Q17). The two offer texts change to the approved words. The funnel step is renamed on the client. Four cleanups remove duplication and add one missing test seam. No behavior changes apart from the two texts and the step name.

**Approved copy (Q15), exact:**

- AI setup lead body: "Formamorph AI writes better narration and keeps characters more consistent than the models that fit your computer. Your support also helps fund new updates."
- Story card body: "Your computer runs a small model that fits its memory. Formamorph AI runs a larger one without turning your computer into a space heater, for sharper narration and characters who stay consistent. Your support includes it, and it helps fund new updates."
- The story card title stays "Want a Bigger Model for This Story?".

- [ ] The AI setup lead body and the built-in engine story card body match the approved copy exactly.
- [ ] The client sends `engine_offer_shown` where it sent `local_offer_shown`. The staff Usage view labels the new name. No code or test names the old step. No alias for the old name exists: it never shipped.
- [ ] The Demo AI card facts and the built-in engine card facts share one shape, and the game view counts a turn for both cards through one call. The existing facts tests pass with their assertions unchanged.
- [ ] `useStoryCard` is renamed `useDemoAIStoryCard` at every use.
- [ ] The engine's device listing returns one device list. The shell derives names from it and no longer keeps two lists in sync.
- [ ] The VRAM class ask has a test seam. A test fails when the handler judges with the shell's own settings and not the saved settings it was given (run once that way, then restore).
- [ ] `docs/` pages that quote the two texts are current, and the existing unreleased changelog entries still describe the feature. No new changelog entry: the feature is unreleased.
- [ ] No world or save export gains a field.

For you: the two texts in place, on the dev routes for AI setup and the engine card.
