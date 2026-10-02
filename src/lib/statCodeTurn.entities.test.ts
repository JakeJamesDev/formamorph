/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeBearers } from './statCodeTraits';
import { inPlayBearers } from './ownedTraitsInPlay';
import { withPersonaEntry } from './persona';
import { encodePlaceholderToken } from './placeholders';
import type { Entity, OwnedTraitStates, PersonaRef, Placeholder, PlayerStat, Trait, TraitGroup } from '@/types';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

// Rook's mood is an Up to One group: switching Angry on retires Calm, as a manual switch does.
const mood: TraitGroup = { id: 'mood', name: 'Mood', parentId: null, maxPicks: 1 };
const calm: Trait = { id: 'calm', name: 'Calm', groupId: 'mood', statChanges: [] };
const angry: Trait = { id: 'angry', name: 'Angry', groupId: 'mood', statChanges: [] };
const scarred: Trait = { id: 'scarred', name: 'Scarred', statChanges: [] };
const marked: Trait = { id: 'marked', name: 'Marked', statChanges: [] };
const veiled: Trait = { id: 'veiled', name: 'Veiled', statChanges: [] };
const loyal: Trait = { id: 'loyal', name: 'Loyal', statChanges: [] };
const rook: Entity = { id: 'rook', name: 'Rook', traits: [calm, angry], traitGroups: [mood] };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true, traits: [scarred] };
const wanderer: Entity = { id: 'wanderer', name: 'Wanderer', customPersona: true, traits: [marked] };
const shade: Entity = { id: 'shade', name: 'Shade', persona: true, personaOnly: true, traits: [veiled] };
const brute: Entity = { id: 'brute', name: 'Brute' };
const pip: Entity = { id: 'pip', name: 'Pip', traits: [loyal] };

/** The trait state of a playthrough under `persona`, with the world's entities and the library ones it carries. */
function played(
  persona: PersonaRef,
  over: { ownedTraits?: OwnedTraitStates; entities?: Entity[]; library?: Entity[] } = {},
): StatCodeBearers {
  const entities = over.entities ?? [rook, mira, wanderer, shade, brute];
  const library = over.library ?? [pip];
  const entered = [...withPersonaEntry(entities, persona, undefined)];
  const bearerWorld = { traits: [], traitGroups: [], entities: entered };
  return {
    acquired: [],
    disabledTraitIds: [],
    appliedValues: {},
    ownedTraits: over.ownedTraits ?? { rook: { chosen: ['calm'] }, mira: { chosen: ['scarred'] } },
    entities,
    library,
    world: {
      traits: [], groups: [], entities: entered, persona,
      bearers: inPlayBearers(bearerWorld, persona, library),
    },
  };
}

const asMira: PersonaRef = { source: 'world', entityId: 'mira' };

/** One stat per piece of code, in order. */
const run = (codes: string[], traits: StatCodeBearers = played(asMira), placeholders: Placeholder[] = []) => runStatCodeTurn({
  stats: codes.map((code, i) => stat({ id: `s${i}`, name: `S${i}`, value: 0, code })),
  enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: traits,
  placeholders: { placeholders, rolls: {} },
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
} satisfies StatCodeTurn);

const valueOf = (out: { stats: readonly PlayerStat[] }, id: string) => out.stats.find((s) => s.id === id)?.value;

/** The names `entities` lists, read back through the stat's value as a bitmask over `names`. */
const listed = async (names: string[], traits: StatCodeBearers) => {
  const code = `return ${JSON.stringify(names)}.reduce((sum, name, i) => sum + (entities[name].name === name ? 2 ** i : 0), 0);`;
  const value = valueOf(await run([code], traits), 's0') ?? 0;
  return names.filter((_, i) => value & (2 ** i));
};

describe('runStatCodeTurn entities', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists the cast, the played persona and the added library characters, and leaves out who is not in play', async () => {
    const names = ['Rook', 'Mira', 'Wanderer', 'Shade', 'Brute', 'Pip'];
    expect(await listed(names, played(asMira))).toEqual(['Rook', 'Mira', 'Brute', 'Pip']);
    // Under None the Custom Persona entity plays; the unpicked persona-only Shade is still out.
    expect(await listed(names, played({ source: 'none', name: 'Typed' }))).toEqual(['Rook', 'Mira', 'Wanderer', 'Brute', 'Pip']);
  });

  it('reads an entity’s traits as its owned state holds them', async () => {
    const out = await run([
      'const t = entities.Rook.traits; return (t.Calm.enabled ? 4 : 0) + (t.Angry.acquired ? 2 : 0) + (t.Scarred.acquired ? 1 : 0);',
    ]);
    expect(valueOf(out, 's0')).toBe(4);
  });

  it('switches an entity’s own trait and cascades as a manual switch does, the player’s lists untouched', async () => {
    const out = await run(['entities.Rook.traits.Angry.enabled = true;']);
    expect(out.traits?.ownedTraits?.rook).toEqual({ chosen: ['calm', 'angry'], disabled: ['calm'] });
    expect(out.traits?.acquired).toEqual([]);
    expect(out.traits?.disabledTraitIds).toEqual([]);
    expect(out.traits?.log).toEqual(["Trait switched off: Rook's Calm (by S0)", "Acquired trait: Rook's Angry (by S0)"]);
  });

  it('switches an added library character’s trait', async () => {
    const out = await run(['entities.Pip.traits.Loyal.enabled = true;']);
    expect(out.traits?.ownedTraits?.pip).toEqual({ chosen: ['loyal'] });
  });

  it('makes persona and its entities entry one entry, so two writes through them are one write', async () => {
    const same = await run(['return persona === entities[persona.name] ? 1 : 0;']);
    expect(valueOf(same, 's0')).toBe(1);

    const out = await run(['persona.traits.Scarred.enabled = false; return entities.Mira.traits.Scarred.enabled ? 1 : 2;']);
    expect(valueOf(out, 's0')).toBe(2);
    expect(out.traits?.ownedTraits?.mira).toEqual({ chosen: ['scarred'], disabled: ['scarred'] });
    expect(out.traits?.log).toEqual(['Trait switched off: Scarred (by S0)']);
  });

  it('gives a shared code name to the later entity, but never takes the played persona’s from it', async () => {
    const lateRook: Entity = { id: 'rook-2', name: 'Rook', traits: [{ ...loyal, id: 'rook-2-loyal' }] };
    const lateMira: Entity = { id: 'mira-2', name: 'Mira', traits: [{ ...loyal, id: 'mira-2-loyal' }] };
    const traits = played(asMira, { library: [lateRook, lateMira] });
    const out = await run(
      ['entities.Rook.traits.Loyal.enabled = true; return persona === entities.Mira && entities.Mira.traits.Scarred.acquired && !entities.Rook.traits.Calm.acquired ? 1 : 0;'],
      traits,
    );
    expect(valueOf(out, 's0')).toBe(1);
    expect(out.traits?.ownedTraits?.['rook-2']).toEqual({ chosen: ['rook-2-loyal'] });
    expect(out.traits?.ownedTraits?.rook).toEqual({ chosen: ['calm'] });
  });

  it('reads an unknown entity as a blank entry, and drops and reports a switch through it', async () => {
    const out = await run(
      ["entities.Shade.traits.Veiled.enabled = true; entities.Nobody.traits.X.enabled = true; return entities.Ghost.name === '' && !entities.Ghost.traits.X.acquired ? 3 : 0;"],
    );
    expect(valueOf(out, 's0')).toBe(3);
    expect(out.traits).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/Shade, Nobody/));
  });

  it('drops and reports a switch of a trait outside the entity’s set', async () => {
    const out = await run(['entities.Rook.traits.Scarred.enabled = true; return 5;']);
    expect(valueOf(out, 's0')).toBe(5);
    expect(out.traits).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/Rook does not have: Scarred/));
  });

  it('reaches an entity whose name carries a chip by its code name', async () => {
    const tag: Placeholder = { id: 'p-tag', name: 'Tag', values: [] };
    const chip = encodePlaceholderToken({ id: 'p-tag', mode: 'world', placementId: 'pl' });
    const tagged: Entity = { ...rook, name: `${chip} Rook` };
    const out = await run(
      ["entities['Tag Rook'].traits.Angry.enabled = true;"],
      played(asMira, { entities: [tagged, mira] }),
      [tag],
    );
    expect(out.traits?.ownedTraits?.rook).toEqual({ chosen: ['calm', 'angry'], disabled: ['calm'] });
  });
});
