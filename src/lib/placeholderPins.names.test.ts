import { describe, it, expect } from 'vitest';
import type { Placeholder } from '@/types';
import { phValues } from '@/test/placeholderValues';
import { encodePlaceholderToken } from './placeholders';
import { allPinRows, type PinEditorWorld } from './placeholderPins';

const chip = (id: string) => encodePlaceholderToken({ id, mode: 'world', placementId: `at-${id}` });
const valueRows = (world: PinEditorWorld) => allPinRows(world).filter((row) => row.source.kind === 'value');

describe('placeholder value pin sources — how a value row names its placeholder', () => {
  const keeper: Placeholder = {
    id: 'keeper', name: 'Keeper',
    values: [{ id: 'k1', text: chip('mood') }, { id: 'k2', text: 'Plain' }],
  };
  const mood: Placeholder = { id: 'mood', name: 'Mood', ownerId: 'keeper', values: phValues(['Calm', 'Tense']) };
  const region: Placeholder = { id: 'region', name: 'Region', values: phValues(['Northern', 'Southern']) };
  const pinning = (values: Placeholder['values']): Placeholder => ({ ...region, values });

  it('reads a shared placeholder by its plain name', () => {
    const world: PinEditorWorld = {
      placeholders: [
        keeper, mood,
        pinning([{ id: 'n', text: 'Northern', pins: [{ placeholderId: 'mood', value: 'Calm' }] }, { id: 's', text: 'Southern', pins: [{ placeholderId: 'mood', value: 'Tense' }] }]),
      ],
    };
    const labels = valueRows(world).map((row) => row.label);
    expect(labels).toEqual(['Region = Northern', 'Region = Southern']);
  });

  it('spells every value of one owned placeholder the same way', () => {
    const owned: Placeholder = {
      ...mood,
      values: [
        { id: 'c', text: 'Calm', pins: [{ placeholderId: 'region', value: 'Northern' }] },
        { id: 't', text: 'Tense', pins: [{ placeholderId: 'region', value: 'Southern' }] },
      ],
    };
    const labels = valueRows({ placeholders: [keeper, owned, region] }).map((row) => row.label);
    expect(labels).toEqual(['Keeper › Mood = Calm', 'Keeper › Mood = Tense']);
  });

  it('names a placeholder anew when its owners or letters change under the same list', () => {
    const list: Placeholder[] = [
      region,
      { id: 'pinner', name: 'Pinner', values: [{ id: 'p1', text: 'Calm', pins: [{ placeholderId: 'region', value: 'Northern' }] }] },
    ];
    const plain = valueRows({ placeholders: list }).map((row) => row.label);
    const owners = new Map([['pinner', { id: 'molly', name: 'Molly', kind: 'entity' as const }]]);
    const owned = valueRows({ placeholders: list, placeholderOwners: owners }).map((row) => row.label);
    expect(plain).toEqual(['Pinner = Calm']);
    expect(owned).toEqual(['Molly › Pinner = Calm']);
  });

  // 400 placeholders with `values` values each, every value pinning; a fresh list each call, so no name carries over.
  const longList = (values: number): Placeholder[] => Array.from({ length: 400 }, (_, i) => ({
    id: `ph${i}`, name: `Placeholder ${i}`,
    values: Array.from({ length: values }, (_, j) => ({ id: `ph${i}-v${j}`, text: `Value ${j}`, pins: [{ placeholderId: 'ph0', value: 'x' }] })),
  }));

  const timeMs = (values: number) => {
    const placeholders = longList(values);
    const started = performance.now();
    valueRows({ placeholders });
    return performance.now() - started;
  };

  const median = (times: number[]) => [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];

  it('names the rows of a long placeholder list in one pass', () => {
    const rows = valueRows({ placeholders: longList(40) });
    expect(rows).toHaveLength(16000);
    expect(rows[16000 - 1].label).toBe('Placeholder 399 = Value 39');

    // One and 40 values per placeholder take turns, so a load spike hits both. Naming each placeholder once,
    // 40x the rows cost about 2x; naming every row cost 40x.
    timeMs(1);
    timeMs(40);
    const one: number[] = [];
    const forty: number[] = [];
    for (let run = 0; run < 7; run++) {
      one.push(timeMs(1));
      forty.push(timeMs(40));
    }
    console.info(`value row names: 400 rows ${median(one).toFixed(1)} ms, 16,000 rows ${median(forty).toFixed(1)} ms`);
    expect(median(forty)).toBeLessThan(9 * median(one));
  });
});
