import { describe, expect, it } from 'vitest';
import { pairedDiff, parseFocusReply, tallyLabels } from './focus-classifier-score';

describe('parseFocusReply', () => {
  it('reads one tier per letter in the contract shape', () => {
    expect(parseFocusReply('A: Focus\nB: Background\nC: Offstage', ['A', 'B', 'C'])).toEqual({ A: 'Focus', B: 'Background', C: 'Offstage' });
  });

  it('reads markdown bullets, bold and a preamble line', () => {
    expect(parseFocusReply('Here are the tiers:\n- **A**: focus\n* B - Background', ['A', 'B'])).toEqual({ A: 'Focus', B: 'Background' });
  });

  it('fails the reply when a letter has no line', () => {
    expect(parseFocusReply('A: Focus', ['A', 'B'])).toBeNull();
  });

  it('fails the reply on a tier word outside the three, even beside a valid line for that letter', () => {
    expect(parseFocusReply('A: Focus\nB: Present\nB: Background', ['A', 'B'])).toBeNull();
  });

  it('fails the reply when one letter gets two tiers', () => {
    expect(parseFocusReply('A: Focus\nA: Offstage', ['A'])).toBeNull();
  });

  it('fails an empty reply', () => {
    expect(parseFocusReply('', ['A'])).toBeNull();
  });
});

describe('tallyLabels', () => {
  it('counts a parse failure as a miss on every entity', () => {
    const tally = tallyLabels([
      { expected: { Ann: 'Focus', Bo: 'Background' }, predicted: { Ann: 'Focus', Bo: 'Offstage' } },
      { expected: { Ann: 'Focus', Bo: 'Background' }, predicted: null },
    ]);
    expect(tally).toEqual({ replies: 2, parseFailures: 1, focusExpected: 2, focusFound: 1, entities: 4, tiersMatched: 1 });
  });

  it('counts an accepted second tier as a match, and nothing else', () => {
    const accepted = { Bo: 'Offstage' } as const;
    const tally = tallyLabels([
      { expected: { Ann: 'Focus', Bo: 'Background' }, predicted: { Ann: 'Focus', Bo: 'Offstage' }, accepted },
      { expected: { Ann: 'Focus', Bo: 'Background' }, predicted: { Ann: 'Focus', Bo: 'Focus' }, accepted },
      { expected: { Ann: 'Focus', Bo: 'Background' }, predicted: null, accepted },
    ]);
    expect(tally.tiersMatched).toBe(3);
  });
});

describe('pairedDiff', () => {
  it('holds no worse when the trimmed arm matches the full arm', () => {
    expect(pairedDiff([1, 0, 1, 0], [1, 0, 1, 0]).noWorse).toBe(true);
  });

  it('fails no worse when the trimmed arm is lower on every pair', () => {
    expect(pairedDiff([1, 1, 1, 1], [0, 0, 0, 0.1]).noWorse).toBe(false);
  });

  it('reads a lower-is-better metric the other way', () => {
    expect(pairedDiff([0, 0, 0, 0], [1, 1, 1, 0.9], false).noWorse).toBe(false);
  });
});
