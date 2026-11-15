import { describe, expect, it } from 'vitest';
import { passageRuns, reviewedCorrections } from './contributionReview';

// A synthetic passage written for these guards.
const passage = '“Go,” Mira said. She left the courier behind.';
const at = (piece: string) => ({ start: passage.indexOf(piece), end: passage.indexOf(piece) + piece.length });

const contribution = {
  passage,
  clusters: [[[at('Mira').start, at('Mira').end], [at('She').start, at('She').end]]] as [number, number][][],
  clusterEntities: ['mira'],
  corrections: [
    { kind: 'mention' as const, ...at('the courier'), entityId: 'kessa' },
    { kind: 'mention' as const, ...at('She'), entityId: null },
    { kind: 'quote' as const, ...at('“Go,”'), entityId: 'kessa' },
  ],
};

describe('a contribution as staff review it', () => {
  it('pairs each correction with the original cluster’s entity, in passage order', () => {
    expect(reviewedCorrections(contribution)).toEqual([
      { kind: 'quote', ...at('“Go,”'), text: '“Go,”', from: null, to: 'kessa' },
      { kind: 'mention', ...at('She'), text: 'She', from: 'mira', to: null },
      { kind: 'mention', ...at('the courier'), text: 'the courier', from: null, to: 'kessa' },
    ]);
  });

  it('finds the original cluster by overlap, not only an exact match (Q38)', () => {
    const wider = { ...contribution, corrections: [{ kind: 'mention' as const, start: at('Mira').start, end: at('said').end, entityId: 'kessa' }] };
    expect(reviewedCorrections(wider)[0].from).toBe('mira');
  });

  it('marks each corrected span and keeps the rest of the passage', () => {
    const runs = passageRuns(passage, [at('She'), at('the courier')]);
    expect(runs.map((r) => r.text).join('')).toBe(passage);
    expect(runs.filter((r) => r.corrected).map((r) => r.text)).toEqual(['She', 'the courier']);
  });

  it('marks overlapping spans once', () => {
    const runs = passageRuns(passage, [at('She left'), at('left the')]);
    expect(runs.map((r) => r.text).join('')).toBe(passage);
    expect(runs.filter((r) => r.corrected).map((r) => r.text)).toEqual(['She left', ' the']);
  });
});
