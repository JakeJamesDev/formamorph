/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path. The real sandbox
 * runs here rather than a stub — a check whose whole job is "what happens when this actually runs" proves
 * nothing against a fake.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Stat, WorldOverview } from '@/types';
import { checkStatCode, STAT_CODE_EXECUTION, STAT_CODE_UNKNOWN_NAME } from './statCodeCheck';
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

  it('runs code that reads a placeholder the world has, and reports none', async () => {
    const world = base([stat({ id: 's1', name: 'Fertility', code: 'return placeholders.Mood.value === "calm" ? 1 : 2;' })]);
    world.placeholders = [{ id: 'mood', name: 'Mood', values: [{ id: 'v:calm', text: 'calm' }] }];
    expect(await checkStatCode(world)).toEqual([]);
  });

  it('runs code that reads and switches a trait the world has, and reports none', async () => {
    const world = base([stat({ id: 's1', name: 'Fertility', code: 'traits.Cursed.enabled = !traits.Cursed.acquired;' })]);
    world.traits = [{ id: 't1', name: 'Cursed', playerDescription: '', aiDescription: '', statChanges: [] }];
    expect(await checkStatCode(world)).toEqual([]);
  });

  it('runs code that sets its own bounds, and reports none', async () => {
    expect(await checkStatCode(base([
      stat({ id: 's1', name: 'Fertility', code: 'self.max = 200; self.regen = 2;' }),
    ]))).toEqual([]);
  });

  // A write to a name the world lacks is dropped at run time, so the author only learns of the typo here.
  it('reports a write to a placeholder or trait the world does not have, as a warning naming the stat', async () => {
    const world = base([
      stat({ id: 's1', name: 'Fertility', code: 'placeholders.Mood.value = "calm"; placeholders.Moood = "x";' }),
      stat({ id: 's2', name: 'Weave', code: 'traits.Cursd.enabled = true; traits.Blessed.enabled = true;' }),
    ]);
    world.placeholders = [{ id: 'mood', name: 'Mood', values: [{ id: 'v:calm', text: 'calm' }] }];
    world.traits = [{ id: 't1', name: 'Cursed', playerDescription: '', aiDescription: '', statChanges: [] }];
    const found = await checkStatCode(world);
    expect(found.map((f) => [f.ruleId, f.severity, f.items[0].id])).toEqual([
      [STAT_CODE_UNKNOWN_NAME.id, 'warning', 's1'],
      [STAT_CODE_UNKNOWN_NAME.id, 'warning', 's2'],
    ]);
    expect(found[0].message).toContain('Fertility');
    expect(found[0].message).toContain('Moood');
    expect(found[0].message).not.toContain('Mood.');
    expect(found[1].message).toContain('Cursd');
    expect(found[1].message).toContain('Blessed');
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

  it('reports code that returns something other than a number as its own failure, not as a throw', async () => {
    const [found] = await checkStatCode(base([
      stat({ id: 's1', name: 'Fertility', code: 'return "25";' }),
    ]));
    expect(found.message).toContain('doesn’t return a number');
    expect(found.message).not.toContain('throws');
  });

  it('reports a placeholder written something other than text as a wrong-type write, not as a throw', async () => {
    const [found] = await checkStatCode({ ...base([
      stat({ id: 's1', name: 'Fertility', code: 'placeholders.Mood.value = {};' }),
    ]), placeholders: [{ id: 'p1', name: 'Mood', values: [{ id: 'v1', text: 'calm' }] }] });
    expect(found.ruleId).toBe(STAT_CODE_EXECUTION.id);
    expect(found.message).toContain('wrong type');
    expect(found.message).not.toContain('throws');
  });

  it('accepts code that sets its value through self and returns nothing', async () => {
    expect(await checkStatCode(base([
      stat({ id: 's1', name: 'Fertility', code: 'self.value = 25;' }),
    ]))).toEqual([]);
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
        code: 'const v = stats.Vigor.value; if (v !== 80) throw new Error("saw " + v); return v;',
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

  // The bundled worlds are the check's real workload: every one must come back clean under the new surface.
  it('reports nothing on the bundled worlds', async () => {
    const worlds = import.meta.glob<{ default: RuleWorld }>('../../defaultworlds/*.json', { eager: true });
    const entries = Object.entries(worlds);
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, world] of entries) {
      expect(await checkStatCode(world.default), path).toEqual([]);
    }
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
