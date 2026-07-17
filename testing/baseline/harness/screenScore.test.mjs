// Unit tests for the model-screen scorer (screenScore.mjs). These call the real scoring functions — the
// dumps below are fixtures, the maths is never re-implemented here.
//
// Every case is a guard against a failure this scorer actually hit or would silently mis-tier:
//  - quoted NPC dialogue tripping the refusal scan (observed: silver-siren wrongly REJECTed on Pell's plea)
//  - a wrong-direction stat (observed: silver-siren gave +Vigor for being mauled)
//  - comma-run-on choices (observed: mistral-heretic emitted one line, not five)
//  - a short dump scoring as a clean run instead of throwing

import { describe, it, expect } from 'vitest';
import {
  scoreDump, tierFor, isEmptyStat, hasRefusalMarker, cleanLoc, pickResponse, aggregateScores, stripReasoning,
} from './screenScore.mjs';

/** Build one turn from a map of requestType -> reply. */
const turn = (replies) => ({
  action: 'x',
  requests: Object.entries(replies).map(([type, response]) => ({ type, response })),
});

/**
 * A dump that scores perfectly: no-op turns emit nothing, combat drops Vigor, only turn 9 routes, every
 * turn's choices are clean, no refusals. `overrides` replaces individual turns by index.
 */
function perfectDump(overrides = {}) {
  const choices = 'I step back.\nI draw my knife.\nI ask her name.';
  const narration = 'You cut the wolf down as it lunges, blood hot on your arm.';
  const dump = Array.from({ length: 10 }, (_, i) => {
    const replies = { narration, choices, locationChange: i === 9 ? 'The Stable Yard' : 'NONE' };
    if ([1, 3, 7].includes(i)) replies.statUpdates = '';
    if ([4, 5].includes(i)) replies.statUpdates = 'Vigor: -12';
    return turn(replies);
  });
  for (const [i, t] of Object.entries(overrides)) dump[Number(i)] = t;
  return dump;
}

describe('hasRefusalMarker', () => {
  it('ignores a refusal phrase spoken by a character in quotes', () => {
    // The exact narration that wrongly rejected silver-siren.
    const n = 'Tears run down his face. "Please," he gasps, "I can\'t—" His words cut off as you shake him.';
    expect(hasRefusalMarker(n)).toBe(false);
  });

  it('flags a refusal in the narrator\'s own voice', () => {
    expect(hasRefusalMarker("I'm sorry, but I can't continue this scene.")).toBe(true);
    expect(hasRefusalMarker('As an AI language model, I must decline.')).toBe(true);
  });

  it('flags a narrator refusal even when the passage also contains quoted dialogue', () => {
    const n = '"Get back!" she shouts. I cannot write this scene.';
    expect(hasRefusalMarker(n)).toBe(true);
  });

  it('does not flag ordinary violent narration', () => {
    expect(hasRefusalMarker('The wolf tears loose and you drive the knife home.')).toBe(false);
  });
});

describe('isEmptyStat', () => {
  it.each([
    ['', 'blank'],
    ['​', 'zero-width space'],
    ['   ', 'whitespace'],
    ['(No stats moved)', 'prose no-change'],
    ['(No stats were moved in this narration)', 'verbose prose no-change'],
    ['nothing notable', 'nothing-notable sentinel'],
    ['NONE', 'none'],
  ])('treats %s (%s) as no change', (input) => {
    expect(isEmptyStat(input)).toBe(true);
  });

  it.each(['Vigor: -12', 'Nerve: +5', '- Nerve: +5'])('treats %s as a real change', (input) => {
    expect(isEmptyStat(input)).toBe(false);
  });
});

describe('cleanLoc / pickResponse', () => {
  it('strips surrounding quotes and whitespace from a destination', () => {
    expect(cleanLoc('  "The Stable Yard" ')).toBe('The Stable Yard');
  });

  it('reads the reply from whichever field the dump used', () => {
    expect(pickResponse({ response: 'a' })).toBe('a');
    expect(pickResponse({ completion: 'b' })).toBe('b');
    expect(pickResponse({})).toBe('');
  });

  it('strips reasoning from the reply, mirroring the app', () => {
    // A reasoning model on the engine path emits an empty <think></think> even when thinking is suppressed;
    // a non-suppressed one emits a full block. Both must vanish before scoring, as the app strips them.
    expect(pickResponse({ response: '<think></think>\nI run.' })).toBe('\nI run.');
    expect(pickResponse({ response: '<think>plan the scene</think>\nYou run.' })).toBe('\nYou run.');
    expect(pickResponse({ response: 'no tags here' })).toBe('no tags here');
  });
});

describe('stripReasoning', () => {
  it('removes each reasoning tag family, complete blocks only', () => {
    expect(stripReasoning('<thinking>a</thinking>X')).toBe('X');
    expect(stripReasoning('<reasoning>a</reasoning>X')).toBe('X');
    expect(stripReasoning('<thought>a</thought>X')).toBe('X');
    // An unterminated block is not a complete block — left as-is rather than eating the rest of the reply.
    expect(stripReasoning('<think>a\nI run.')).toBe('<think>a\nI run.');
    expect(stripReasoning(null)).toBe('');
  });
});

describe('tierFor', () => {
  it.each([[85, 'S'], [92, 'S'], [70, 'A'], [77, 'A'], [50, 'B'], [65, 'B'], [49, 'C'], [0, 'C']])(
    'maps objective %i to tier %s', (obj, expected) => {
      expect(tierFor(obj, true, true)).toBe(expected);
    });

  it('rejects on the location hard gate regardless of score', () => {
    expect(tierFor(100, false, true)).toBe('REJECT (routing)');
  });

  it('flags a refusal with a warning suffix but never auto-rejects', () => {
    // Willingness is a review flag: a flagged model keeps its earned tier.
    expect(tierFor(77, true, false)).toBe('A ⚠');
    expect(tierFor(20, true, false)).toBe('C ⚠');
  });
});

describe('scoreDump', () => {
  it('throws on a short dump instead of scoring a failed run as clean', () => {
    expect(() => scoreDump(perfectDump().slice(0, 4))).toThrow(/4\/10 turns/);
    expect(() => scoreDump([])).toThrow(/0\/10 turns/);
  });

  it.each([[null], [undefined], [{ turns: [] }], ['nope']])('throws on a non-array dump (%s)', (bad) => {
    expect(() => scoreDump(bad)).toThrow(/10 turns/);
  });

  it('scores a dump that captured no requests as a reject, not a clean sweep', () => {
    // Guards the zero-denominator fallbacks: if any of them returned 100 instead of 0, a dump with nothing
    // in it would score S with both gates green.
    const empty = Array.from({ length: 10 }, () => ({ action: 'x', requests: [] }));
    const s = scoreDump(empty);
    expect(s.restraint).toBe(0);
    expect(s.statDir).toBe(0);
    expect(s.format).toBe(0);
    expect(s.locAcc).toBe(0);
    expect(s.objective).toBe(0);
    expect(s.locGate).toBe(false);
    expect(s.tier).toBe('REJECT (routing)');
  });

  it('tolerates a turn with no requests key at all', () => {
    const dump = perfectDump({ 2: { action: 'x' } });
    expect(() => scoreDump(dump)).not.toThrow();
    expect(scoreDump(dump).chDen).toBe(9);
  });

  it('counts a reasoning model\'s choices as clean once reasoning is stripped', () => {
    // Anko on the engine path prefixes every reply with an empty <think></think> (thinking suppressed). Scored
    // raw, that stray line makes acts.length !== lines.length and format reads 0 — but the app strips it and
    // parses three clean actions. Every turn here carries the prefix; format must still be 100.
    const withThink = (replies) =>
      turn(Object.fromEntries(Object.entries(replies).map(([k, v]) => [k, `<think></think>\n${v}`])));
    const dump = perfectDump();
    for (let i = 0; i < 10; i++) {
      const base = { narration: 'You cut the wolf down as it lunges.', choices: 'I step.\nI draw.\nI ask.', locationChange: i === 9 ? 'The Stable Yard' : 'NONE' };
      if ([1, 3, 7].includes(i)) base.statUpdates = '';
      if ([4, 5].includes(i)) base.statUpdates = 'Vigor: -12';
      dump[i] = withThink(base);
    }
    const s = scoreDump(dump);
    expect(s.format).toBe(100);
    expect(s.locAcc).toBe(100);
    expect(s.statDir).toBe(100);
  });

  it('scores a clean run as S with both gates passing', () => {
    const s = scoreDump(perfectDump());
    expect(s.restraint).toBe(100);
    expect(s.statDir).toBe(100);
    expect(s.format).toBe(100);
    expect(s.locAcc).toBe(100);
    expect(s.objective).toBe(100);
    expect(s.willingnessPass).toBe(true);
    expect(s.locGate).toBe(true);
    expect(s.tier).toBe('S');
  });

  it('counts a stat line on a no-op turn as a false positive', () => {
    const dump = perfectDump({
      3: turn({ narration: 'You chat.', choices: 'I ask.\nI wait.\nI nod.', locationChange: 'NONE', statUpdates: 'Nerve: -2' }),
    });
    const s = scoreDump(dump);
    expect(s.statFP).toBe(1);
    expect(s.statFPden).toBe(3);
    expect(s.restraint).toBeCloseTo(66.67, 1);
  });

  it('does not count a prose "no stats moved" as a false positive', () => {
    const dump = perfectDump({
      3: turn({ narration: 'You chat.', choices: 'I ask.\nI wait.\nI nod.', locationChange: 'NONE', statUpdates: '(No stats moved)' }),
    });
    expect(scoreDump(dump).statFP).toBe(0);
  });

  // silver-siren awarded +Vigor for being mauled — a gain must never score, whether the model signs it or
  // not. The unsigned form is what actually exercises the `< 0` check: a bare `-?` regex wouldn't even parse
  // "+5", so testing only the signed form passes for the wrong reason.
  it.each([['Vigor: +5', 'signed gain'], ['Vigor: 5', 'unsigned gain']])(
    'credits a Vigor drop on injury but not %s (%s)', (statLine) => {
      const dump = perfectDump({
        5: turn({ narration: 'Teeth rake your arm.', choices: 'I strike.\nI reel.\nI grab.', locationChange: 'NONE', statUpdates: statLine }),
      });
      const s = scoreDump(dump);
      expect(s.vigOk).toBe(1); // only turn 4's -12
      expect(s.vigDen).toBe(2);
      expect(s.statDir).toBe(50);
    });

  it('credits a signed drop, not just an unsigned one', () => {
    const dump = perfectDump({
      4: turn({ narration: 'The wolf lunges.', choices: 'I strike.\nI reel.\nI grab.', locationChange: 'NONE', statUpdates: 'Vigor: -8' }),
      5: turn({ narration: 'Teeth rake your arm.', choices: 'I strike.\nI reel.\nI grab.', locationChange: 'NONE', statUpdates: 'Vigor: -3\nNerve: -2' }),
    });
    expect(scoreDump(dump).vigOk).toBe(2);
  });

  it('counts a routing miss when a non-move turn names a destination', () => {
    const dump = perfectDump({
      7: turn({ narration: 'You glance at the door.', choices: 'I look.\nI wait.\nI turn.', locationChange: 'The Stable Yard', statUpdates: '' }),
    });
    const s = scoreDump(dump);
    expect(s.locErr).toBe(1);
    expect(s.locGate).toBe(true); // 9/10 = 90%, still at the gate
  });

  it('rejects when routing misses push accuracy under the gate', () => {
    const dump = perfectDump();
    for (const i of [0, 1, 2]) dump[i].requests.find((r) => r.type === 'locationChange').response = 'The Stable Yard';
    const s = scoreDump(dump);
    expect(s.locAcc).toBe(70);
    expect(s.locGate).toBe(false);
    expect(s.tier).toBe('REJECT (routing)');
  });

  it('counts a routing miss when the move turn fails to route', () => {
    const dump = perfectDump();
    dump[9].requests.find((r) => r.type === 'locationChange').response = 'NONE';
    expect(scoreDump(dump).locErr).toBe(1);
  });

  it('rejects comma-run-on choices as unclean', () => {
    // mistral-heretic's actual failure: five actions on one line.
    const dump = perfectDump({
      2: turn({ narration: 'You talk.', choices: 'I check on Pell, I calm Sable, I secure the wolf.', locationChange: 'NONE' }),
    });
    const s = scoreDump(dump);
    expect(s.chOk).toBe(9);
    expect(s.chDen).toBe(10);
  });

  it('rejects choices with a lead-in line', () => {
    const dump = perfectDump({
      2: turn({ narration: 'You talk.', choices: 'Here are your options:\nI ask.\nI wait.\nI nod.', locationChange: 'NONE' }),
    });
    expect(scoreDump(dump).chOk).toBe(9);
  });

  it('flags but does not reject a narrator-voice refusal', () => {
    const dump = perfectDump({
      6: turn({ narration: "I'm sorry, I can't write that.", choices: 'I ask.\nI wait.\nI nod.', locationChange: 'NONE' }),
    });
    const s = scoreDump(dump);
    expect(s.refus).toBe(1);
    expect(s.gateDen).toBe(4);
    expect(s.willingnessPass).toBe(false);
    expect(s.tier).toBe('S ⚠');
  });

  it('ignores requests the dump did not capture rather than counting them as misses', () => {
    const dump = perfectDump({ 4: turn({ narration: 'You strike.' }) }); // no stat/loc/choices captured
    const s = scoreDump(dump);
    expect(s.vigDen).toBe(1);
    expect(s.locDen).toBe(9);
    expect(s.chDen).toBe(9);
  });
});

describe('aggregateScores', () => {
  // A seed's shape, only the fields the aggregate reads.
  const seed = (o = {}) => ({
    restraint: 0, statDir: 100, format: 100, locAcc: 100, objective: 65,
    refus: 0, gateDen: 4, ...o,
  });

  it('throws on an empty list rather than reporting a zeroed verdict', () => {
    expect(() => aggregateScores([])).toThrow(/no scores/);
    expect(() => aggregateScores(null)).toThrow(/no scores/);
  });

  it('means each axis across seeds and reports the spread', () => {
    const a = aggregateScores([
      seed({ objective: 40, format: 60, locAcc: 100 }),
      seed({ objective: 60, format: 100, locAcc: 90 }),
      seed({ objective: 50, format: 80, locAcc: 100 }),
    ]);
    expect(a.n).toBe(3);
    expect(a.objective).toBe(50);
    expect(a.format).toBeCloseTo(80, 5);
    expect(a.locAcc).toBeCloseTo(96.67, 1);
    expect(a.objMin).toBe(40);
    expect(a.objMax).toBe(60);
    expect(a.tier).toBe('B');
  });

  it('evaluates the routing gate on the mean, not on any single seed', () => {
    // One bad seed (70%) must not reject a model that routes fine on average — this is exactly the flip
    // that made n=1 verdicts untrustworthy.
    const ok = aggregateScores([seed({ locAcc: 70 }), seed({ locAcc: 100 }), seed({ locAcc: 100 })]);
    expect(ok.locAcc).toBeCloseTo(90, 5);
    expect(ok.locGate).toBe(true);
    expect(ok.tier).not.toMatch(/REJECT/);

    const bad = aggregateScores([seed({ locAcc: 60 }), seed({ locAcc: 70 }), seed({ locAcc: 80 })]);
    expect(bad.locGate).toBe(false);
    expect(bad.tier).toBe('REJECT (routing)');
  });

  it('flags willingness if any seed tripped a marker, and sums the denominators', () => {
    const a = aggregateScores([seed(), seed({ refus: 1 }), seed()]);
    expect(a.refus).toBe(1);
    expect(a.gateDen).toBe(12);
    expect(a.willingnessPass).toBe(false);
    expect(a.tier).toMatch(/⚠$/);
  });

  it('passes a single seed through unchanged', () => {
    const a = aggregateScores([seed({ objective: 77 })]);
    expect(a.n).toBe(1);
    expect(a.objective).toBe(77);
    expect(a.objMin).toBe(77);
    expect(a.objMax).toBe(77);
    expect(a.tier).toBe('A');
  });
});
