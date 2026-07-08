// Deterministic arrival-timing scripts for the `/markdown test [profile]` reveal harness. Each profile
// turns a text length into a schedule of `{ atMs, chars }` arrival events — "by this wall-clock time,
// this many characters have streamed in" — which the GameViewer driver replays through the real reveal
// path (estimator → pacer → renderer). Because the schedule is fixed, a recording of it is reproducible:
// run it before and after a change, freeze-map both, and any difference is the change, not turn-to-turn
// luck. The narration below deliberately includes the markdown cases that used to fuse sentences (a
// sentence ending inside emphasis, a paragraph ending on an em-dash, a bare bold stat line).

export const REVEAL_TEST_NARRATION = `The gate shudders as you brace against it, servos whining under the strain. Rust flakes drift down like *dead snow*, and somewhere beyond the wall the horde answers with a single, rising howl.

You throw your weight into the mechanism and the ancient bolts finally give. The doors grind inward, revealing a courtyard choked with ivy and the *broken statues* of forgotten kings. A cold wind moves through it, carrying the smell of wet stone and older things.

Something is already here. It unfolds from the shadow of the eastern arch — too many limbs, too little grace — and turns its eyeless face toward you.

**Power: 62%**

Your targeting array locks on before you consciously decide to fight. The first volley catches it mid-stride, and it *shrieks*, a sound like tearing metal that sets your plating ringing. It does not fall. It only comes faster, and the courtyard suddenly feels very small.

You give ground, wheels skidding on loose gravel, and put the fountain between you and the thing. Water black with age sloshes over the rim. For one heartbeat you are almost calm — and then it leaps.`;

export interface RevealArrivalEvent {
  /** Milliseconds from the start of the run at which this many characters have arrived. */
  atMs: number;
  /** Cumulative character count of the text streamed so far. */
  chars: number;
}

export interface RevealTestProfile {
  label: string;
  description: string;
  schedule: (length: number) => RevealArrivalEvent[];
}

// Roughly one to two words per emitted event, so the schedule has sentence-scale granularity.
const STEP_CHARS = 8;

/** Append steady-rate arrival events for chars `[from, to)` starting at `startMs`, at `cps` chars/sec.
 *  Returns the wall-clock time of the last event. */
function stream(events: RevealArrivalEvent[], startMs: number, from: number, to: number, cps: number): number {
  const msPerChar = 1000 / cps;
  let c = from;
  let t = startMs;
  while (c < to) {
    c = Math.min(to, c + STEP_CHARS);
    t = startMs + (c - from) * msPerChar;
    events.push({ atMs: Math.round(t), chars: c });
  }
  return t;
}

export const REVEAL_TEST_PROFILES: Record<string, RevealTestProfile> = {
  // The LM Studio signature: a large first flush lands instantly (poisoning any tokens/sec estimate),
  // then a steady ~23 words/s (~140 cps). This is the pattern that produced the pop-train.
  burst: {
    label: 'Burst then steady',
    description: 'big instant flush, then steady ~23 w/s — the estimator-poisoning case',
    schedule: (len) => {
      const events: RevealArrivalEvent[] = [];
      const b = Math.min(len, 400);
      // The flush arrives as many stepped events all at t≈0 (a near-infinite cps), so the driver
      // pushes it sentence-by-sentence in one tick — exactly as production processes a fat network
      // chunk — rather than one lumped push that the pacer would release as a single block.
      stream(events, 0, 0, b, 1e6);
      if (b < len) stream(events, 60, b, len, 140);
      return events;
    },
  },
  // A clean constant ~18 words/s — the baseline that should already look smooth.
  steady: {
    label: 'Steady',
    description: 'constant ~18 w/s, no burst — the smooth baseline',
    schedule: (len) => { const e: RevealArrivalEvent[] = []; stream(e, 0, 0, len, 110); return e; },
  },
  // A slow model (~4.5 words/s) — the case the old 90ms reveal ceiling forced into stutter.
  slow: {
    label: 'Slow steady',
    description: 'constant ~4.5 w/s — the slow-model / ceiling case',
    schedule: (len) => { const e: RevealArrivalEvent[] = []; stream(e, 0, 0, len, 28); return e; },
  },
  // A very fast model (~60 words/s) — the reveal should stay smooth by trailing, not sprint-and-stall.
  fast: {
    label: 'Fast steady',
    description: 'constant ~60 w/s — the fast-model floor case',
    schedule: (len) => { const e: RevealArrivalEvent[] = []; stream(e, 0, 0, len, 360); return e; },
  },
  // Wildly inconsistent: instant chunks separated by long pauses — stresses feedback in both directions.
  erratic: {
    label: 'Erratic',
    description: 'instant chunks with long pauses — stresses pace feedback both ways',
    schedule: (len) => {
      const events: RevealArrivalEvent[] = [];
      let c = 0;
      let t = 0;
      while (c < len) {
        c = Math.min(len, c + 130);
        events.push({ atMs: Math.round(t), chars: c });
        t += 450; // dead air before the next chunk
      }
      return events;
    },
  },
};

export const DEFAULT_REVEAL_TEST_PROFILE = 'burst';
