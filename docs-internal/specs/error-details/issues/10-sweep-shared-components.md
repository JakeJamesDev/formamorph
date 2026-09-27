# 10: Sweep: shared components and game panels

Status: ready-for-human
Base: 418b140f
Blocked by: 01 — Details field and headline
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The same sweep for the four error toasts the first three sweeps missed, in the shared components folder and the game panels: the AI generate button, the AI setup gate, the bundled-content link choice and the like prompt. Caught-error toasts move to the shared helper with their current message as the headline; validation and refusal toasts stay plain. No wording changes.

The setup gate's toast carries an error string from the engine; wrap it the way ticket 01 wraps a string result. The like prompt's toast fires after a failed send, so it converts with the caught error.

Recommended model rationale: the same mechanical sweep as tickets 07 to 09, over four sites.

## Acceptance criteria

- [x] Every caught-error toast in those four files goes through the shared helper and offers **View Details →**
- [x] Every validation or refusal toast in those files stays plain with no link
- [x] No toast's visible words changed; a test that asserted a plain string may switch to reading the toast's visible text, with the asserted words identical
- [x] No `toast.error` in a `catch` remains anywhere under `src/` except the recorded exemptions
- [x] Four gates green
