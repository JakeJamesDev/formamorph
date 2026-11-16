# 21: Streaming Colors Fallback

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Spec Q74 (1): when the model can't read quotes as fast as the stream brings them, the turn stops gating quotes and colors after narration, as before Q72, so the reveal keeps today's even pace.

- **The decision:** compare the device's carried run time (ticket 18 keeps it across turns) with the measured arrival rate. When the model can't keep up, the turn falls back. Pick the rule and its threshold from measurements, and record them in the ticket.
- **Once per turn:** a turn may switch to the fallback once, at any point, and never back. After the switch, the pacer runs as today's, and quotes color at narration end with the full-turn reading.
- **Quotes already read** before the switch keep their streamed colors.
- **Unchanged:** a GPU device (runs of 17–119 ms) never falls back on the test scripts.
- **Changelog:** fold into the unreleased Character Mentions entries.

## Acceptance criteria

- [x] Fake 1.25 s run, probe passage and 12-line dialogue, `steady` script. At 100 tokens/s the turn falls back, and its longest word gap and reveal time match today's pacer within 10%. Ticket 18 measured 68 ms and 3.5 s for today at 100 tokens/s on the probe. The test is proved by removing the fallback. (`falls back to today's pace … at 100 tokens/s`, both passages: an exact match, 68 ms / 3.5 s and 36 ms / 2.0 s. Removing the fallback turns both red, and the mid-turn test too.)
- [x] At 50 tokens/s with the same run, the turn keeps streaming colors, with no word gap over 150 ms (ticket 18's bar). (`keeps streaming colors with every word under 150 ms …`, both passages: no fallback, no uncolored quote, 138 and 139 ms.)
- [x] With a 60 ms run, no turn falls back at 25, 50 or 100 tokens/s. (`never falls back with a 60 ms run`, both passages, warm-up and measured turns.)
- [x] A turn that falls back mid-way keeps its already-colored quotes and never re-enters gating. (`keeps the colors read before a mid-turn fallback …`: slow, a 200 tokens/s burst, slow again. One fallback; read quotes keep their speakers, later ones stay uncolored, no read and no gate check after it. The reader's own test covers the run in flight.)
- [x] Report the threshold, and a table of longest word gap and reveal time for each speed, before and after. (Below.)

## Landed

**The rule:** the pacer falls back once one run of the carried run time spans more than 50 words of the measured arrival rate (`QUOTE_FALLBACK_RUN_WORDS`), checked at every release. It switches at most once per turn. From then on the pacer runs as today's, and the reader reads nothing more. Quotes read before the switch keep their colors; the rest wait for the full-turn reading.

**Why 50:** with a 1.25 s run, the gated pace passes 150 ms between 50 tokens/s (about 46 words per run, 138 ms) and 55 tokens/s (about 51 words, 157–162 ms). At 46 and 48, rate noise trips a mid-turn fallback at 50 tokens/s. At 52, 55 tokens/s stays gated. 50 is the only value tried that splits them on both passages. A 60 ms run spans 1–4 words, far below.

Longest word gap / reveal time, fake 1.25 s run, `steady` token stream (warm-up turn, then the measured one):

| Passage | Tokens/s | Before (gated) | After | Today |
|---|---|---|---|---|
| Probe | 25 | 274 ms / 15.1 s | 274 ms / 15.1 s | 274 ms / 13.8 s |
| Probe | 50 | 138 ms / 8.3 s | 138 ms / 8.3 s | 138 ms / 6.9 s |
| Probe | 100 | 264 ms / 5.8 s | 68 ms / 3.5 s (fell back) | 68 ms / 3.5 s |
| 12-line dialogue | 25 | 139 ms / 8.9 s | 139 ms / 8.9 s | 147 ms / 7.9 s |
| 12-line dialogue | 50 | 139 ms / 5.7 s | 139 ms / 5.7 s | 74 ms / 4.0 s |
| 12-line dialogue | 100 | 150 ms / 4.2 s | 36 ms / 2.0 s (fell back) | 36 ms / 2.0 s |

The 12-line dialogue is ticket 18's (two alternating lines, Wren and the keeper), now in the reveal test.

The `steady` and `burst` scripts never fall back with 17, 60, 119 or 1250 ms runs. They stream near 23 words/s, so a 1.25 s run spans about 29 words. The session's first turn falls back too at 100 tokens/s, once its first run replaces the 250 ms default.

**Not verified**
- Real bursty streams near 50 tokens/s. The rule compares one run with the current arrival average, and a turn's first rate sample replaces the carried one, so a fast burst can drop the gate for the rest of the turn. The `burst` script did not trip it; a real stream near the threshold may.
- No app run. The decision lives in the pacer and the reader, and the tests drive the real pacer and reader. The render path is unchanged: a quote the reader drops shows as an unread one did before Q72.

**Found while building** (not fixed here)
- A denser dialogue, where every line opens on a quote with a different tag, shows a 179 ms gated gap at 25 and 50 tokens/s with a 1.25 s run, over ticket 18's 150 ms bar. It stays gated, since 50 tokens/s is under the threshold. Today's pacer shows 174 ms / 88 ms there.
- The first fallback draft released one sentence twice: the reader's notify re-entered the pacer mid-release. The landed code pumps afresh after the switch, and the 100 tokens/s dialogue test catches the double release.

**For you**
- On a CPU-only device (small model, about 1.25 s per run) with a fast model, the reveal should keep today's pace, and the quotes not yet colored should take their colors when the turn finishes.
