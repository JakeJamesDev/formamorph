import { describe, expect, it } from 'vitest';
import { pairedDiff, parseFocusReply, tallyLabels } from './focus-classifier-score';

describe('parseFocusReply', () => {
  it('reads one tier per letter in the contract shape', () => {
    expect(parseFocusReply('A: Focus\nB: Mentionable\nC: Unused', ['A', 'B', 'C'])).toEqual({ A: 'Focus', B: 'Mentionable', C: 'Unused' });
  });

  it('reads markdown bullets, bold and a preamble line', () => {
    expect(parseFocusReply('Here are the tiers:\n- **A**: focus\n* B - Mentionable', ['A', 'B'])).toEqual({ A: 'Focus', B: 'Mentionable' });
  });

  it('fails the reply when a letter has no line', () => {
    expect(parseFocusReply('A: Focus', ['A', 'B'])).toBeNull();
  });

  it('fails the reply on a tier word outside the three, even beside a valid line for that letter', () => {
    expect(parseFocusReply('A: Focus\nB: Present\nB: Mentionable', ['A', 'B'])).toBeNull();
  });

  it('fails the reply when one letter gets two tiers', () => {
    expect(parseFocusReply('A: Focus\nA: Unused', ['A'])).toBeNull();
  });

  it('fails an empty reply', () => {
    expect(parseFocusReply('', ['A'])).toBeNull();
  });
});

describe('tallyLabels', () => {
  it('counts a parse failure as a miss on every entity', () => {
    const tally = tallyLabels([
      { expected: { Ann: 'Focus', Bo: 'Mentionable' }, predicted: { Ann: 'Focus', Bo: 'Unused' } },
      { expected: { Ann: 'Focus', Bo: 'Mentionable' }, predicted: null },
    ]);
    expect(tally).toEqual({ replies: 2, parseFailures: 1, focusExpected: 2, focusFound: 1, entities: 4, tiersMatched: 1 });
  });

  it('counts an accepted second tier as a match, and nothing else', () => {
    const accepted = { Bo: 'Unused' } as const;
    const tally = tallyLabels([
      { expected: { Ann: 'Focus', Bo: 'Mentionable' }, predicted: { Ann: 'Focus', Bo: 'Unused' }, accepted },
      { expected: { Ann: 'Focus', Bo: 'Mentionable' }, predicted: { Ann: 'Focus', Bo: 'Focus' }, accepted },
      { expected: { Ann: 'Focus', Bo: 'Mentionable' }, predicted: null, accepted },
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
