import { describe, expect, it } from 'vitest';
import { REQUEST_STATUS } from '@/components/game/statusGlyphs/glyphMap';
import { REQUEST_LABELS } from '@/lib/promptGroups';
import { BREAKDOWN_GROUPS, breakdownPromptLabel, rollupBreakdown } from './breakdownRollup';

const ALL_TYPES = Object.keys(REQUEST_STATUS);
const group = (rollup: ReturnType<typeof rollupBreakdown>, id: string) => rollup.groups.find((g) => g.id === id)!;

describe('BREAKDOWN_GROUPS', () => {
  it('holds every prompt type in exactly one group', () => {
    const grouped = BREAKDOWN_GROUPS.flatMap((g) => g.types as readonly string[]);
    expect([...grouped].sort()).toEqual([...ALL_TYPES].sort());
  });

  it('names every prompt type, from AI settings or its own name', () => {
    for (const type of ALL_TYPES) expect(breakdownPromptLabel(type as never)).toBeTruthy();
    expect(breakdownPromptLabel('thinking')).toBe(REQUEST_LABELS.thinking);
    expect(breakdownPromptLabel('imageTags')).toBe('Image Tags');
  });

  it('repeats no group name as a prompt name', () => {
    for (const g of BREAKDOWN_GROUPS) {
      if (g.types.length < 2) continue;
      for (const type of g.types) expect(breakdownPromptLabel(type)).not.toBe(g.label);
    }
  });
});

describe('rollupBreakdown', () => {
  it('lists all seven groups in order, zero shares included', () => {
    const rollup = rollupBreakdown({ narration: 100 }, 10);
    expect(rollup.groups.map((g) => g.id)).toEqual(['narration', 'planning', 'choices', 'tracking', 'inventory', 'memory', 'help']);
    expect(group(rollup, 'choices').percent).toBe(0);
  });

  it('names a prompt at the threshold and not below it', () => {
    const at = rollupBreakdown({ narration: 60, thinking: 10, director: 9.9, statUpdates: 20.1 }, 10);
    expect(group(at, 'planning').prompts.map((p) => p.type)).toEqual(['thinking']);
    expect(group(at, 'planning').prompts[0]).toMatchObject({ label: 'Planning', percent: 10 });
    expect(group(at, 'tracking').prompts.map((p) => p.type)).toEqual(['statUpdates']);
  });

  it('nests nothing without a threshold', () => {
    expect(group(rollupBreakdown({ thinking: 50, narration: 50 }, null), 'planning').prompts).toEqual([]);
  });

  it('adds no nested row to a one-prompt group', () => {
    const rollup = rollupBreakdown({ narration: 70, choices: 20, inventory: 10 }, 10);
    for (const id of ['narration', 'choices', 'inventory']) expect(group(rollup, id).prompts).toEqual([]);
  });

  it('totals 100 with largest-remainder rounding', () => {
    const rollup = rollupBreakdown({ narration: 33.4, choices: 33.3, inventory: 33.3 }, 50);
    expect(rollup.groups.reduce((sum, g) => sum + g.percent, 0)).toBe(100);
    expect(group(rollup, 'narration').percent).toBe(34);
    const thirds = rollupBreakdown({ narration: 1, choices: 1, inventory: 1, thinking: 1, summary: 1, help: 1, statUpdates: 1 }, 50);
    expect(thirds.groups.reduce((sum, g) => sum + g.percent, 0)).toBe(100);
  });

  it('scales shares that do not add to 100', () => {
    const rollup = rollupBreakdown({ narration: 49.9, choices: 49.9 }, 10);
    expect(rollup.groups.reduce((sum, g) => sum + g.percent, 0)).toBe(100);
    expect(group(rollup, 'narration').percent).toBe(50);
  });

  it('scales a nested row by the same total as its group', () => {
    const rollup = rollupBreakdown({ narration: 40, thinking: 50 }, 10);
    expect(group(rollup, 'planning').percent).toBe(56);
    expect(group(rollup, 'planning').prompts[0].percent).toBe(56);
  });

  it('shows an Other row only above zero, for other and unknown types', () => {
    expect(rollupBreakdown({ narration: 100 }, 10).groups.some((g) => g.id === 'other')).toBe(false);
    expect(rollupBreakdown({ narration: 100, other: 0 }, 10).groups.some((g) => g.id === 'other')).toBe(false);
    const withOther = rollupBreakdown({ narration: 80, other: 10, madeUpType: 10 }, 10);
    expect(withOther.groups.at(-1)).toMatchObject({ id: 'other', label: 'Other', percent: 20 });
  });

  it('reports an empty week for an empty breakdown', () => {
    expect(rollupBreakdown({}, 10)).toEqual({ empty: true, groups: [] });
    expect(rollupBreakdown({ narration: 0 }, 10).empty).toBe(true);
  });
});
