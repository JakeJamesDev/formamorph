import { describe, expect, it } from 'vitest';
import {
  loadGoldClusters, loadGoldSet, readGold, readGoldAsPlayer, scoreQuotes, scoreReadings, trainingDataDir, type GoldSetName, type Tally,
} from '@/test/corefGold';

// The Mention Reading over the private gold sets with the e120 model's recorded clusters. The floors are the
// evaluation's scores (spec, Further Notes); a rule change that lowers one, or adds wrong links, fails.
const dir = trainingDataDir();
const clusters = dir ? loadGoldClusters(dir, 'litbank-e120') : null;
const ready = !!dir && !!clusters && (['real', 'hard', 'blind', 'quotes'] as GoldSetName[]).every((s) => loadGoldSet(dir, s));

type Floor = [ok: number, maxWrong: number];
const FLOORS: Record<'real' | 'hard' | 'blind', Partial<Record<'name' | 'descriptor' | 'pronoun' | 'traps' | 'presence', Floor>>> = {
  blind: { name: [75, 1], descriptor: [24, 3], pronoun: [110, 7], traps: [34, 0], presence: [27, 0] },
  hard: { name: [15, 0], descriptor: [8, 0], pronoun: [40, 0], traps: [8, 0], presence: [9, 0] },
  // The real set labels pronouns only. Presence is 18, one under the evaluation: Q34's player rule.
  real: { pronoun: [119, 0], traps: [41, 0], presence: [18, 0] },
};

const meets = (t: Tally, [ok, maxWrong]: Floor) => ({ ok: t.ok >= ok, wrong: t.wrong <= maxWrong });

describe.skipIf(!ready)('Mention Reading on the gold sets (e120 clusters)', () => {
  it.each([
    ...(['blind', 'hard', 'real'] as const).map((set) => [set, '', readGold] as const),
    // The persona rule (Q61) moves only player spans, which the gold labels as no one. ff-13 merges "You" into
    // Keshari's cluster, a miss either way.
    ...(['blind', 'hard', 'real'] as const).map((set) => [set, ' with a persona', readGoldAsPlayer] as const),
  ])('holds the %s set%s at or above the evaluation', (set, _persona, read) => {
    const score = scoreReadings(loadGoldSet(dir!, set)!, read(clusters!, set));
    for (const [kind, floor] of Object.entries(FLOORS[set])) {
      const t = score[kind as keyof typeof FLOORS[typeof set]];
      expect(meets(t, floor!), `${set} ${kind} ${t.ok}/${t.total}, ${t.wrong} wrong\n${score.fails.join('\n')}`)
        .toEqual({ ok: true, wrong: true });
    }
  });

  it.each([['', readGold], [' with a persona', readGoldAsPlayer]] as const)('attributes the labeled quotes%s', (_persona, read) => {
    const score = scoreQuotes(loadGoldSet(dir!, 'quotes')!, read(clusters!, 'real'));
    expect(score.total).toBeGreaterThanOrEqual(60);
    expect({ ok: score.ok >= 65, wrong: score.wrong }, score.fails.join('\n')).toEqual({ ok: true, wrong: 0 });
  });
});
