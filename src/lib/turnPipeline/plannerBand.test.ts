import { describe, it, expect } from 'vitest';
import { buildPlannerBand, type PlannerBandInput } from './plannerBand';
import type { BandTurn } from '../turnBanding';

const turn = (i: number, summary?: string): BandTurn => ({
  index: i,
  turnId: `t${i}`,
  userMsg: { role: 'user', content: `action ${i}` },
  gameText: `Narration ${i}. `.repeat(40),
  ...(summary ? { summary } : {}),
});

const base = (over: Partial<PlannerBandInput> = {}): PlannerBandInput => ({
  turns: [turn(1, 'Digest one.'), turn(2, 'Digest two.'), turn(3, 'Digest three.'), turn(4)],
  template: '## Planning\nPlan the next beat.',
  ctx: {},
  contextWindow: 8192,
  verbatimFloor: 1,
  milestoneDrop: null,
  recapPrompt: 'What has happened so far:',
  relevanceScores: null,
  bandCap: 0,
  stickyIds: null,
  notes: [],
  fallbackLastStory: 'NARRATION FROM THE WIDER WINDOW',
  ...over,
});

describe('buildPlannerBand', () => {
  it('takes its last story from the planner band, not narration s', () => {
    const { lastStory } = buildPlannerBand(base());
    expect(lastStory).not.toBe('NARRATION FROM THE WIDER WINDOW');
    expect(lastStory).toContain('Narration 4.');
  });

  it('falls back to narration s last story when the planner band holds no assistant message', () => {
    expect(buildPlannerBand(base({ turns: [] })).lastStory).toBe('NARRATION FROM THE WIDER WINDOW');
  });

  it('condenses everything past the floor into the recap', () => {
    const { recap } = buildPlannerBand(base());
    expect(recap).toContain('Digest one.');
    expect(recap).toContain('Digest three.');
    // The floor turn stays verbatim, so its narration is not in the recap.
    expect(recap).not.toContain('Narration 4.');
  });

  it('honors a wider floor by keeping more turns out of the recap', () => {
    const { recap } = buildPlannerBand(base({ verbatimFloor: 3 }));
    expect(recap).toContain('Digest one.');
    expect(recap).not.toContain('Digest three.');
  });

  it('drops the memories milestone selection removed', () => {
    const { recap } = buildPlannerBand(base({ milestoneDrop: new Set(['t2']) }));
    expect(recap).toContain('Digest one.');
    expect(recap).not.toContain('Digest two.');
  });

  it('shrinks the band when the planner s own endpoint is small', () => {
    // A long story, so a narrower window has something it must actually drop.
    const turns = Array.from({ length: 20 }, (_, i) => turn(i + 1, `Digest ${i + 1}: ${'detail '.repeat(20)}`));
    const wide = buildPlannerBand(base({ turns, contextWindow: 32000 }));
    const narrow = buildPlannerBand(base({ turns, contextWindow: 1000 }));
    const digests = ({ recap }: { recap: string }) => (recap.match(/Digest \d+:/g) ?? []).length;
    expect(digests(wide)).toBeGreaterThan(digests(narrow));
    // Unscored, the budget loop drops from the oldest, so what survives is the recent tail.
    expect(narrow.recap).toContain('Digest 19:');
    expect(narrow.recap).not.toContain('Digest 1:');
  });
});
