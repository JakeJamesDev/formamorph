/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatCodeTurn, type StatCodeTurn } from './statCodeTurn';
import type { StatCodeBearers } from './statCodeTraits';
import { inPlayBearers } from './ownedTraitsInPlay';
import { recordKey } from './ownedTraitState';
import { withPersonaEntry } from './persona';
import { encodePlaceholderToken } from './placeholders';
import type { Entity, OwnedTraitStates, PersonaRef, Placeholder, PlayerStat, Trait } from '@/types';

const stat = (over: Partial<PlayerStat>): PlayerStat => ({
  id: 'x', name: 'Stat', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0, ...over,
});

// A world Brave the player can pick, and a played persona that owns its own Brave and Scarred.
const worldBrave: Trait = { id: 'w-brave', name: 'Brave', statChanges: [] };
const scarred: Trait = { id: 'scarred', name: 'Scarred', statChanges: [{ statId: 'h', value: -10, type: 'starting' }] };
const miraBrave: Trait = { id: 'm-brave', name: 'Brave', statChanges: [] };
const marked: Trait = { id: 'marked', name: 'Marked', statChanges: [] };
const rookScarred: Trait = { id: 'r-scarred', name: 'Scarred', statChanges: [] };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true, traits: [scarred, miraBrave] };
const wanderer: Entity = { id: 'wanderer', name: 'Wanderer', customPersona: true, traits: [marked] };
const rook: Entity = { id: 'rook', name: 'Rook', traits: [rookScarred] };

/** The trait state of a playthrough under `persona`, with the world's entities and the library ones it carries. */
function played(
  persona: PersonaRef,
  over: { ownedTraits?: OwnedTraitStates; acquired?: Trait[]; entities?: Entity[]; library?: Entity[] } = {},
): StatCodeBearers {
  const entities = over.entities ?? [mira, wanderer];
  const library = over.library ?? [];
  // Play's bearers and gate entities carry the player's entry in the Custom Persona entity's name.
  const entered = [...withPersonaEntry(entities, persona, library[0]?.name)];
  const bearerWorld = { traits: [worldBrave], traitGroups: [], entities: entered };
  return {
    acquired: over.acquired ?? [],
    disabledTraitIds: [],
    appliedValues: { [recordKey('mira', 'scarred')]: { h: -10 } },
    ownedTraits: over.ownedTraits ?? { mira: { chosen: ['scarred'] } },
    entities,
    library,
    world: {
      traits: [worldBrave], groups: [], entities: entered, persona,
      bearers: inPlayBearers(bearerWorld, persona, library),
    },
  };
}

const asMira: PersonaRef = { source: 'world', entityId: 'mira' };

/** Health at 40 under Scarred, plus one stat per piece of code, in order. */
const run = (codes: string[], traits: StatCodeBearers = played(asMira)) => runStatCodeTurn({
  stats: [stat({ id: 'h', name: 'Health', value: 40 }), ...codes.map((code, i) => stat({ id: `s${i}`, name: `S${i}`, value: 0, code }))],
  enabled: {}, previous: [], asks: [], regenApplied: {}, clock: {}, bearers: traits,
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name,
} satisfies StatCodeTurn);

const valueOf = (out: { stats: readonly PlayerStat[] }, id: string) => out.stats.find((s) => s.id === id)?.value;

describe('runStatCodeTurn persona traits', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('reads true for the reporter’s check on a trait the played persona holds', async () => {
    const out = await run(["if (persona.traits['Scarred'].enabled) return 1; return 2;"]);
    expect(valueOf(out, 's0')).toBe(1);
  });

  it('reads a switched-off persona trait as off but still acquired', async () => {
    const out = await run(
      ["const t = persona.traits.Scarred; return (t.enabled ? 2 : 0) + (t.acquired ? 1 : 0);"],
      played(asMira, { ownedTraits: { mira: { chosen: ['scarred'], disabled: ['scarred'] } } }),
    );
    expect(valueOf(out, 's0')).toBe(1);
  });

  it('reads a trait in the persona’s set it never chose as neither on nor acquired', async () => {
    const out = await run(['const t = persona.traits.Brave; return 10 + (t.enabled ? 2 : 0) + (t.acquired ? 1 : 0);']);
    expect(valueOf(out, 's0')).toBe(10);
  });

  it('switches the persona’s own trait off and reverses what it moved, leaving the player’s list alone', async () => {
    const out = await run(['persona.traits.Scarred.enabled = false;']);
    expect(out.traits?.ownedTraits).toEqual({ mira: { chosen: ['scarred'], disabled: ['scarred'] } });
    expect(out.traits?.acquired).toEqual([]);
    expect(out.traits?.disabledTraitIds).toEqual([]);
    expect(out.traits?.log).toEqual(['Trait switched off: Scarred (by S0)']);
    expect(valueOf(out, 'h')).toBe(50);
  });

  it('acquires a trait in the persona’s set on a switch-on, as traits does', async () => {
    const out = await run(['persona.traits.Brave.enabled = true;']);
    expect(out.traits?.ownedTraits?.mira).toEqual({ chosen: ['scarred', 'm-brave'] });
    expect(out.traits?.acquired).toEqual([]);
    expect(out.traits?.log).toEqual(['Acquired trait: Brave (by S0)']);
  });

  it('drops and reports a write to acquired and a switch of a name outside the persona’s set', async () => {
    const out = await run(['persona.traits.Scarred.acquired = false; persona.traits.Marked.enabled = true; return 7;']);
    expect(out.traits).toBeUndefined();
    expect(valueOf(out, 's0')).toBe(7);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Scarred'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Marked'));
  });

  it('keeps a world trait and a persona trait with one name apart, in reads and in writes', async () => {
    const traits = played(asMira, { ownedTraits: { mira: { chosen: ['scarred', 'm-brave'] } } });
    const read = await run(['return (traits.Brave.enabled ? 2 : 0) + (persona.traits.Brave.enabled ? 1 : 0);'], traits);
    expect(valueOf(read, 's0')).toBe(1);

    const persona = await run(['persona.traits.Brave.enabled = false;'], traits);
    expect(persona.traits?.ownedTraits?.mira).toEqual({ chosen: ['scarred', 'm-brave'], disabled: ['m-brave'] });
    expect(persona.traits?.acquired).toEqual([]);

    const world = await run(['traits.Brave.enabled = true;'], traits);
    expect(world.traits?.acquired.map((t) => t.id)).toEqual(['w-brave']);
    expect(world.traits?.ownedTraits?.mira).toEqual({ chosen: ['scarred', 'm-brave'] });
  });

  it('plays the Custom Persona entity as persona under None', async () => {
    const out = await run(
      ["return persona.name === 'Wanderer' && persona.traits.Marked.enabled && !persona.traits.Scarred.acquired ? 1 : 0;"],
      played({ source: 'none', name: 'Typed Name' }, { ownedTraits: { wanderer: { chosen: ['marked'] } } }),
    );
    expect(valueOf(out, 's0')).toBe(1);
  });

  it('plays the library persona, not the Custom Persona entity, under a library persona', async () => {
    const out = await run(
      ["return persona.name === 'Rook' && persona.traits.Scarred.enabled && !persona.traits.Marked.acquired ? 1 : 0;"],
      played({ source: 'library', entityId: 'rook' }, {
        library: [rook], ownedTraits: { rook: { chosen: ['r-scarred'] }, wanderer: { chosen: ['marked'] } },
      }),
    );
    expect(valueOf(out, 's0')).toBe(1);
  });

  it('reads an empty persona where no persona entity plays, and the check does not throw', async () => {
    const out = await run(
      ["return persona.name === '' && !persona.traits['Scarred']?.enabled ? 1 : 0;"],
      played({ source: 'none' }, { entities: [mira] }),
    );
    expect(valueOf(out, 's0')).toBe(1);
  });

  it('drops and reports a persona switch where no persona entity plays, and the run still sets its value', async () => {
    const out = await run(['persona.traits.Scarred.enabled = true; return 3;'], played({ source: 'none' }, { entities: [mira] }));
    expect(out.traits).toBeUndefined();
    expect(valueOf(out, 's0')).toBe(3);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Scarred'));
  });

  it('names a library persona and its trait by a chip from the persona’s own placeholders', async () => {
    const tag: Placeholder = { id: 'p-tag', name: 'Tag', values: [] };
    const chip = encodePlaceholderToken({ id: 'p-tag', mode: 'world', placementId: 'pl' });
    const tagged: Entity = { ...rook, name: `${chip} Rook`, placeholders: [tag], traits: [{ ...rookScarred, name: `${chip} Scar` }] };
    const out = await run(
      ["return persona.name === 'Tag Rook' && persona.traits['Tag Scar'].enabled ? 1 : 0;"],
      played({ source: 'library', entityId: 'rook' }, { library: [tagged], ownedTraits: { rook: { chosen: ['r-scarred'] } } }),
    );
    expect(valueOf(out, 's0')).toBe(1);
  });

  it('switches the persona’s trait by its code name, the world’s Brave left alone', async () => {
    const out = await run(['persona.traits.Brave.enabled = true; traits.Brave.enabled = false;']);
    expect(out.traits?.log).toEqual(['Acquired trait: Brave (by S0)']);
    expect(out.traits?.disabledTraitIds).toEqual([]);
  });
});
