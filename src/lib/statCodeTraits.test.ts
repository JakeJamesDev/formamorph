import { describe, it, expect } from 'vitest';
import { savedTraits } from './statCodeTraits';
import type { Trait } from '@/types';

describe('savedTraits', () => {
  const saved: Trait = { id: 'brave', name: 'Brave', statChanges: [{ statId: 'h', value: 10, type: 'starting' }] };
  const authored: Trait = { id: 'brave', name: 'Bold', playerToggle: true, statChanges: [{ statId: 'h', value: 99, type: 'starting' }] };

  it('re-reads each trait from the world but keeps the stat changes the save settled against', () => {
    const { acquired } = savedTraits({ playerTraits: [saved] }, [authored]);
    expect(acquired).toEqual([{ ...authored, statChanges: saved.statChanges }]);
  });

  it('reads a save with no switched-off traits and no records as empty', () => {
    expect(savedTraits({ playerTraits: [] }, [])).toEqual({ acquired: [], disabledTraitIds: [], appliedValues: {} });
  });

  it('carries the switched-off ids and the movement records through', () => {
    const out = savedTraits({ playerTraits: [saved], disabledTraitIds: ['brave'], appliedTraitValues: { brave: { h: 10 } } }, [authored]);
    expect(out).toMatchObject({ disabledTraitIds: ['brave'], appliedValues: { brave: { h: 10 } } });
  });
});
