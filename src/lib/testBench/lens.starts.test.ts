import { describe, it, expect } from 'vitest';
import { phValues } from '@/test/placeholderValues';
import type { ChoiceWorldOption, Entity, Placeholder, Stat, Trait } from '@/types';
import { buildLens, lensStartingStats, type LensWorld } from './lens';

/** The lens seeds stats through the opening's steps: Option starts, entity trait starts, cast global rows (Q27, Q29). */

const hair: Placeholder = { id: 'ph-hair', name: 'Hair Color', values: phValues(['ash', 'copper']) };
const gold: Stat = { id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [] };

// Health ≤ 30 pins hair to ash: the start sits in the band at 10, and leaves it at 30 + 1.
const health: Stat = {
  id: 'health', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 15, regen: 0,
  descriptors: [{ id: 'd-low', threshold: 30, description: 'Hurt', placeholderPins: [{ placeholderId: 'ph-hair', value: 'ash' }] }],
};

const easy = (statChanges: ChoiceWorldOption['values'][number]['statChanges']): ChoiceWorldOption => ({
  id: 'diff', name: 'Difficulty', type: 'choice', shownToPlayer: true, midGame: true, default: 'easy',
  values: [{ id: 'easy', name: 'Easy', statChanges }],
});

const dragon = (over: Partial<Entity> = {}): Entity => ({ id: 'dragon', name: 'Dragon', stats: [health], ...over } as Entity);

const worldOf = (over: Partial<LensWorld>): LensWorld => ({
  traits: [], traitGroups: [], locations: [], placeholders: [hair], stats: [gold], ...over,
});

const lensOf = (w: LensWorld) => buildLens(w, { personaId: null, pickedTraitId: null, locationId: null });

describe('the lens opening starts', () => {
  it('pins a stat band from the value the picked Option row raises (Q29)', () => {
    // 15 is in the ≤ 30 band; Easy's "Health starting +20" lifts it to 35, out of the band.
    const options = [easy([{ statId: 'health', ownerId: 'dragon', type: 'starting', value: 20 }])];
    expect(lensOf(worldOf({ entities: [dragon()], options: [easy([])] })).pins).toEqual({ 'ph-hair': 'ash' });
    expect(lensOf(worldOf({ entities: [dragon()], options })).pins).toEqual({});
  });

  it('reads the Option value the author picked over the default', () => {
    const options: ChoiceWorldOption[] = [{
      ...easy([]), default: 'easy',
      values: [
        { id: 'easy', name: 'Easy', statChanges: [] },
        { id: 'boost', name: 'Boost', statChanges: [{ statId: 'health', ownerId: 'dragon', type: 'starting', value: 20 }] },
      ],
    }];
    const w = worldOf({ entities: [dragon()], options });
    expect(lensOf(w).pins).toEqual({ 'ph-hair': 'ash' });
    expect(buildLens(w, { personaId: null, locationId: null, optionValues: { diff: 'boost' } }).pins).toEqual({});
  });

  it('applies an entity’s default trait start to its stats', () => {
    const vigor: Trait = { id: 't-vigor', name: 'Vigor', isDefault: true, statChanges: [{ statId: 'health', type: 'starting', value: 20 }] };
    expect(lensOf(worldOf({ entities: [dragon({ traits: [vigor] })] })).pins).toEqual({});
    expect(lensOf(worldOf({ entities: [dragon({ traits: [{ ...vigor, isDefault: false }] })] })).pins).toEqual({ 'ph-hair': 'ash' });
  });

  it('applies a cast entity’s default global row to the global stats', () => {
    const boast: Trait = { id: 't-boast', name: 'Boast', isDefault: true, playerToggle: true, statChanges: [{ statId: 'gold', type: 'starting', value: 7 }] };
    const w = (traits: Trait[]) => worldOf({ entities: [dragon({ stats: [], traits })] });
    expect(lensStartingStats(w([boast]), [gold], []).find((s) => s.id === 'gold')?.value).toBe(17);
    expect(lensStartingStats(w([{ ...boast, isDefault: false }]), [gold], []).find((s) => s.id === 'gold')?.value).toBe(10);
  });
});
