import { describe, it, expect } from 'vitest';
import type { Entity, LayeredMediaEntry, MediaLayer, MediaList, Stat, TraitRequirementRow, WorldOverview } from '@/types';
import { blankItem } from '@/lib/items';
import { checkLayeredSizes } from './layeredSizes';
import { runRules, type RuleWorld } from './rules';

const health: Stat = { id: 'health', name: 'Health', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] };
const statRow = (id: string, operator: '<' | '>' | '<=' | '>=', value: number): TraitRequirementRow[] =>
  [{ all: [{ kind: 'stat', id, operator, value, unit: 'raw' }] }];
const traitRow = (id: string): TraitRequirementRow[] => [{ all: [{ kind: 'trait', id }] }];

const image = (id: string, data = `data:${id}`) => ({ id, name: id, kind: 'image' as const, data });
const layer = (id: string, variants: MediaLayer['variants']): MediaLayer => ({ id, name: id, variants });
const rigOf = (layers: MediaLayer[]): LayeredMediaEntry => ({ id: 'rig', name: 'Wick Rig', kind: 'layered', layers });
const listOf = (rig: LayeredMediaEntry): MediaList => ({
  ...Object.fromEntries(['body', 'hurt', 'calm'].map((id) => [id, image(id)])), [rig.id]: rig,
});

const resident = (links: boolean): Entity => ({
  id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the harbor lamps lit.',
  locations: ['harbor'], ...(links ? { images: [{ mediaId: 'rig' }] } : {}),
});
const world = (rig: LayeredMediaEntry, links = true): RuleWorld => ({
  worldOverview: {
    name: 'Sedge Landing', description: '', systemPrompt: 'Narrate.', readme: 'Primer.', mediaList: listOf(rig),
  } as WorldOverview,
  stats: [health], locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }], entities: [resident(links)],
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});
const flags = (w: RuleWorld, ruleId: string) => runRules(w).filter((f) => f.ruleId === ruleId);

/** A sound rig: a bottom Layer that always shows, and a Face on a rule that exists. */
const sound = () => rigOf([layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'hurt', requires: statRow('health', '<', 50) }])]);

describe('Layered Image Test Bench rules', () => {
  it('stays quiet on a sound rig', () => {
    const ids = runRules(world(sound())).map((f) => f.ruleId).filter((id) => id.startsWith('layered-'));
    expect(ids).toEqual([]);
  });

  describe('layered-no-layers', () => {
    it('flags a rig with no Layers, naming it and opening its Media card', () => {
      const found = flags(world(rigOf([])), 'layered-no-layers');
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain('Wick Rig');
      expect(found[0].items).toEqual([{ id: 'rig', name: 'Wick Rig', section: 'media' }]);
    });
  });

  describe('layered-bottom-empty', () => {
    const ruled = (...rows: TraitRequirementRow[][]) => rigOf([layer('body', rows.map((requires, i) => ({ mediaId: i ? 'calm' : 'hurt', requires })))]);

    it('flags a bottom Layer whose every Variant has a rule, naming the rig and the Layer', () => {
      const found = flags(world(ruled(statRow('health', '<', 50), statRow('health', '<', 20))), 'layered-bottom-empty');
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain('Wick Rig · body');
    });

    it('is quiet when one Variant has no rule', () => {
      const rig = rigOf([layer('body', [{ mediaId: 'hurt', requires: statRow('health', '<', 50) }, { mediaId: 'calm' }])]);
      expect(flags(world(rig), 'layered-bottom-empty')).toEqual([]);
    });

    it('is quiet when two rules are a Condition and its opposite', () => {
      expect(flags(world(ruled(statRow('health', '>', 50), statRow('health', '<=', 50))), 'layered-bottom-empty')).toEqual([]);
    });

    it('flags a bottom Layer with no Variants', () => {
      const found = flags(world(rigOf([layer('body', []), layer('face', [{ mediaId: 'hurt' }])])), 'layered-bottom-empty');
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain('no Variant');
    });

    it('judges only the bottom Layer', () => {
      const rig = rigOf([layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'hurt', requires: statRow('health', '<', 50) }])]);
      expect(flags(world(rig), 'layered-bottom-empty')).toEqual([]);
    });
  });

  describe('layered-rule-missing-target', () => {
    it('flags a Variant rule that names a trait the world lacks, naming the rig and the Layer', () => {
      const rig = rigOf([layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'hurt', requires: traitRow('ghost') }])]);
      const found = flags(world(rig), 'layered-rule-missing-target');
      expect(found).toHaveLength(1);
      expect(found[0].severity).toBe('error');
      expect(found[0].message).toContain('Wick Rig · face');
      expect(found[0].items[0].id).toBe('rig');
    });

    it('flags a Variant rule that names a stat the world lacks', () => {
      const rig = rigOf([layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'hurt', requires: statRow('mana', '<', 5) }])]);
      const found = flags(world(rig), 'layered-rule-missing-target');
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain('stat');
    });

    it('judges a rig no slot links against the world’s names', () => {
      const rig = rigOf([layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'hurt', requires: traitRow('ghost') }])]);
      expect(flags(world(rig, false), 'layered-rule-missing-target')).toHaveLength(1);
      expect(flags(world(sound(), false), 'layered-rule-missing-target')).toEqual([]);
    });

    it('names the entity that lacks the target', () => {
      const rig = rigOf([layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'hurt', requires: traitRow('ghost') }])]);
      expect(flags(world(rig), 'layered-rule-missing-target')[0].message).toContain('“Odd Wick”');
    });

    it.each([
      ['a location', (w: RuleWorld): RuleWorld => ({ ...w, entities: [resident(false)], locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, images: [{ mediaId: 'rig' }] }] })],
      ['an item', (w: RuleWorld): RuleWorld => ({ ...w, entities: [resident(false)], items: [{ ...blankItem('lantern', 'Tin Lantern'), images: [{ mediaId: 'rig' }] }] })],
    ])('judges a rig linked from %s', (_name, link) => {
      const bad = rigOf([layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'hurt', requires: traitRow('ghost') }])]);
      expect(flags(link(world(bad)), 'layered-rule-missing-target')).toHaveLength(1);
      expect(flags(link(world(sound())), 'layered-rule-missing-target')).toEqual([]);
    });

    it('ignores a Variant whose image is gone', () => {
      const rig = rigOf([layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'lost', requires: traitRow('ghost') }])]);
      expect(flags(world(rig), 'layered-rule-missing-target')).toEqual([]);
    });
  });

  describe('layered size mismatch', () => {
    const sizes: Record<string, { width: number; height: number }> = {
      'data:body': { width: 240, height: 288 }, 'data:hurt': { width: 480, height: 576 }, 'data:calm': { width: 240, height: 288 },
    };
    const rig = rigOf([layer('body', [{ mediaId: 'body' }]), layer('face', [{ mediaId: 'hurt' }, { mediaId: 'calm' }])]);

    it('flags each Variant whose size differs from the canvas, naming the rig and the Layer', () => {
      const found = checkLayeredSizes(world(rig), (data) => sizes[data]);
      expect(found).toHaveLength(1);
      expect(found[0].ruleId).toBe('layered-size-mismatch');
      expect(found[0].message).toContain('Wick Rig · face');
      expect(found[0].message).toContain('480×576');
    });

    it('raises nothing while sizes are unknown', () => {
      expect(checkLayeredSizes(world(rig), () => undefined)).toEqual([]);
    });
  });
});
