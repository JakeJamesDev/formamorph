/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path. The real sandbox
 * runs here rather than a stub — a check whose whole job is "what happens when this actually runs" proves
 * nothing against a fake.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Stat, WorldOverview } from '@/types';
import { checkStatCode, STAT_CODE_EXECUTION } from './statCodeCheck';
import { groupFindings, type RuleWorld } from './rules';

const base = (stats: Stat[]): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'Narrate the fen.' } as WorldOverview,
  stats,
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: [], traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

const stat = (over: Partial<Stat> & { id: string; name: string }): Stat => ({
  type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...over,
});

describe('the on-demand stat-code check', () => {
  // The executor logs its error paths to console.error by design; keep test output clean.
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('says nothing about code that runs and returns a number', async () => {
    expect(await checkStatCode(base([
      stat({ id: 's1', name: 'Fertility', code: 'return 25;' }),
      stat({ id: 's2', name: 'Vigor' }),
    ]))).toEqual([]);
  });

  it('reports code that throws, naming the stat and the failure', async () => {
    const [found] = await checkStatCode(base([
      stat({ id: 's1', name: 'Fertility', code: 'return stats.find(s => s.name === "Missing").value;' }),
    ]));
    expect(found.ruleId).toBe(STAT_CODE_EXECUTION.id);
    expect(found.severity).toBe('error');
    expect(found.section).toBe('stats');
    expect(found.items.map((i) => i.id)).toEqual(['s1']);
    expect(found.message).toContain('Fertility');
    expect(found.message).toContain('throws');
  });

  it('reports code that never returns a number as its own failure, not as a throw', async () => {
    const [found] = await checkStatCode(base([
      stat({ id: 's1', name: 'Fertility', code: 'const x = 25;' }),
    ]));
    expect(found.message).toContain('doesn’t return a number');
    expect(found.message).not.toContain('throws');
  });

  it('reports code that never finishes as a timeout', async () => {
    const [found] = await checkStatCode(base([
      stat({ id: 's1', name: 'Fertility', code: 'while (true) {}' }),
    ]));
    expect(found.message).toContain('times out');
  }, 15000);

  it('runs each coded stat against the world’s starting values, so a run mirrors turn one', async () => {
    // Vigor opens at 80; code reading it must see 80, not the live-value default of zero.
    const found = await checkStatCode(base([
      stat({ id: 's1', name: 'Vigor', starting: 80 }),
      stat({
        id: 's2',
        name: 'Fertility',
        code: 'const v = stats.find(s => s.name === "Vigor").value; if (v !== 80) throw new Error("saw " + v); return v;',
      }),
    ]));
    expect(found).toEqual([]);
  });

  it('checks every coded stat rather than stopping at the first failure', async () => {
    const found = await checkStatCode(base([
      stat({ id: 's1', name: 'Fertility', code: 'throw new Error("nope");' }),
      stat({ id: 's2', name: 'Weave', code: 'return "not a number";' }),
      stat({ id: 's3', name: 'Vigor', code: 'return 10;' }),
    ]));
    expect(found.map((f) => f.items[0].id)).toEqual(['s1', 's2']);
  });

  it('says nothing about stats with no code, or blank code', async () => {
    expect(await checkStatCode(base([
      stat({ id: 's1', name: 'Vigor' }),
      stat({ id: 's2', name: 'Weave', code: '   ' }),
    ]))).toEqual([]);
  });

  it('collapses its findings into one counted row like any other rule', async () => {
    const found = await checkStatCode(base([
      stat({ id: 's1', name: 'Fertility', code: 'throw new Error("nope");' }),
      stat({ id: 's2', name: 'Weave', code: 'return "not a number";' }),
    ]));
    const [group] = groupFindings(found);
    expect(group.headline).toContain('2');
    expect(group.fixable).toBe(false);
    expect(group.items.map((i) => i.id)).toEqual(['s1', 's2']);
  });
});
