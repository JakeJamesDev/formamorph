# 06: In Scene and Memory

Status: ready-for-human
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The Mention Reading feeds In Scene, the diary passes and memory.

- **In Scene:** `readNarration` takes the turn's reading when it exists.
  - Entities with a linked mention in the prose, outside quoted speech, join the participant union. They count for In Scene and get diary and discover work.
  - The reading only adds participants. It never removes a name-based one.
- **Met:** stays name-based. A pronoun or descriptor never makes an entity met.
- **Memory input:**
  - A bracketed view of the narration ("she [Mira] left") is the input to the digest, diary and milestone passes only.
  - A pass that runs before the reading exists reads the plain text.
- **Leaks:** brackets never reach the display text, the narration prompt history, read-aloud, choices, exports or the Narration Stream.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [x] An entity shown only by pronoun joins In Scene and gets a diary pass. Tests run through `readNarration` with a fake reading. Verified by narrationReading "adds an entity shown only by pronoun…", mentionMemory "puts a pronoun-only stranger In Scene…" (presence) and backgroundPassQueue "gives an entity the reading alone shows a diary pass".
- [x] A pronoun-only mention of an unmet stranger does not make the stranger met. Verified by mentionMemory "…leaves it unmet, under its Stranger Name": presence `met: false`, label shown, `introducedIds` empty.
- [x] Digest, diary and milestone inputs carry bracketed names when a reading exists, and plain text when it does not. Verified by backgroundPassQueue "feeds the digest and diary the bracketed narration…" and "reads the plain text with no reading…". The milestone reads digests, never narration, so it gets names through them (Q53).
- [x] Leak tests: with a reading present, no bracket appears on any non-memory surface listed above. Each leak test is proved by reinstating the leak. Verified by backgroundPassQueue "leaves no bracket in the history and never names the unmet stranger": stored narration, digests and diaries, and the narration prompt's banded and verbatim history. Reinstated the echo (digest and diary), the view stored as narration, and the true name in a stranger bracket; each went red.
- [x] With the feature off, participants and memory inputs are identical to today. Verified by "matches today" tests in narrationReading and mentionMemory, and the feature-off case in backgroundPassQueue; reinstating an ungated view went red.

For you: in one playthrough, compare a few memory summaries with and without the feature.

## Landed

**Not verified**

- The leak test reads the stored turn and the narration prompt history builders. Display, read-aloud, choices, exports and the Narration Stream are not tested one by one. They all read the stored narration, which the test proves stays plain. The brackets exist only inside the digest and diary requests.

**For you**

- In one playthrough, compare a few memory summaries with and without the feature. Open the Memory panel after a few turns where a character acts only as "she" or "he".
- A digest that runs before the reading lands reads the plain text and is not redone. Check how often summaries in play actually get the names.
- An unmet stranger shown only by pronoun now gets a diary entry. The pass names the stranger by true name, as a name-based diary does today, while the narration it reads carries the label. Judge whether those entries read well.
