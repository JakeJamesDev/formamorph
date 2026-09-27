import { describe, it, expect } from 'vitest';
import { sandboxTraits, savedTraits } from './statCodeTraits';
import { applyCodeTraitSwitches } from './traitRuntime';
import type { Trait } from '@/types';

describe('savedTraits', () => {
  const saved: Trait = { id: 'brave', name: 'Brave', statChanges: [{ statId: 'h', value: 10, type: 'starting' }] };
  const authored: Trait = { id: 'brave', name: 'Bold', playerToggle: true, statChanges: [{ statId: 'h', value: 99, type: 'starting' }] };

  it('re-reads each trait from the world but keeps the stat changes the save settled against', () => {
    const { acquired } = savedTraits({ playerTraits: [saved] }, [authored]);
    expect(acquired).toEqual([{ ...authored, statChanges: saved.statChanges }]);
  });

  it('reads a save with no switched-off traits, no records and no cascade-off list as empty', () => {
    expect(savedTraits({ playerTraits: [] }, []))
      .toEqual({ acquired: [], disabledTraitIds: [], appliedValues: {}, cascadeOffTraitIds: {}, ownedTraits: {} });
  });

  it('carries the switched-off ids, the movement records, the cascade-off list and owned state through', () => {
    const out = savedTraits({
      playerTraits: [saved], disabledTraitIds: ['brave'], appliedTraitValues: { brave: { h: 10 } },
      cascadeOffTraitIds: { world: ['brave'] }, ownedTraits: { ash: { chosen: ['tamed'] } },
    }, [authored]);
    expect(out).toMatchObject({
      disabledTraitIds: ['brave'], appliedValues: { brave: { h: 10 } }, cascadeOffTraitIds: { world: ['brave'] },
      ownedTraits: { ash: { chosen: ['tamed'] } },
    });
  });
});

describe('sandboxTraits under gates', () => {
  // A code switch-on of a locked trait leaves it acquired and off; the sandbox entry keeps its three fields.
  const paladin: Trait = { id: 'paladin', name: 'Paladin', statChanges: [] };
  const plate: Trait = { id: 'plate', name: 'Plate Armor', statChanges: [], requires: [{ kind: 'trait', id: 'paladin' }] };
  const world = { traits: [paladin, plate], groups: [] };

  it('reads a locked trait code switched on as acquired and not enabled', () => {
    const start = { stats: [], traits: [], disabledTraitIds: [], appliedValues: {} };
    const { state } = applyCodeTraitSwitches(start, [{ traitId: 'plate', enabled: true, by: 'Vigor' }], world);
    expect(sandboxTraits({ acquired: state.traits, disabledTraitIds: state.disabledTraitIds, appliedValues: {}, world }, []))
      .toEqual([
        { name: 'Paladin', acquired: false, enabled: false },
        { name: 'Plate Armor', acquired: true, enabled: false },
      ]);
  });
});
