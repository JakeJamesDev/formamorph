import { describe, it, expect } from 'vitest';
import { liveChipScene, type LiveSceneSources } from './liveScene';
import { chipValues, entityStatsField } from './chipValues';
import { resolveOwners, type OwnerWorld } from '../owners';
import { resolveOwnerText, resolveEntityText } from '../placeholders';
import { buildCharacterUserMessage, buildDiaryUserMessage } from '../stagedPlanning';
import { buildToolSnapshot } from '../tools/toolSnapshot';
import { renderPromptTemplate } from '../promptTemplate';
import { layerValues } from '../promptValues';
import type { Entity, GameLocation, PersonaRef, PlayerStat, StatGroup, Trait, TraitGroup, TraitLink } from '@/types';

// The harbor: the Quay contains the Warehouse.
const quay: GameLocation = { id: 'quay', name: 'Quay', aiDescription: 'Wet stone and rope.' };
const warehouse: GameLocation = { id: 'warehouse', name: 'Warehouse', parentId: 'quay', aiDescription: 'Crates to the rafters.' };

// The authored cast, plus a character the story invented in the Warehouse.
const harbormaster: Entity = { id: 'harbormaster', name: 'Harbormaster', locations: ['quay'], aiDescription: 'Keeps the ledger.' };
const porter: Entity = {
  id: 'porter', name: 'Porter', locations: ['warehouse'], aiDescription: '{{char}} hauls crates.',
  aiSummary: '{{char}}, a hauler.',
};
const stray: Entity = { id: 'stray', name: 'Stray', locations: ['warehouse'], aiDescription: 'Turned up one night.' };
const entities = [harbormaster, porter];

const grit: PlayerStat = {
  id: 'grit', name: 'Grit', type: 'number', description: 'Nerve.', min: 0, max: 10, value: 4, regen: 0, descriptors: [],
};
const seaLegs: Trait = { id: 'sea-legs', name: 'Sea Legs', aiDescription: 'Steady on {{deck}}.', statChanges: [] };

const sources = (over: Partial<LiveSceneSources> = {}): LiveSceneSources => ({
  overview: 'A working harbor.',
  stats: [grit],
  statPlacement: { groups: [], authored: [grit] },
  traits: [seaLegs],
  traitGroups: [],
  resolve: (text) => text.replaceAll('{{deck}}', 'a wet deck'),
  resolveTrait: (_trait, text, owner) =>
    resolveEntityText(owner ?? null, text.replaceAll('{{deck}}', 'any deck'), { placeholders: [], rolls: {} }),
  resolveEntity: (entity, text) => resolveEntityText(entity, text, { placeholders: [], rolls: {} }),
  persona: null,
  location: quay,
  locations: [quay, warehouse],
  connections: [],
  entities,
  allEntities: [...entities, stray],
  participants: [],
  notes: '',
  time: null,
  placeholders: [],
  ...over,
});

describe('the live adapter', () => {
  it('rosters Here from the full cast and the outer scopes from the authored cast', () => {
    const values = chipValues(liveChipScene(sources({ location: warehouse })));
    expect(values('<ENTITIES|name>')).toBe('Porter, Stray');
    // Back on the Quay, the invented character is in the Warehouse but the outer scope never lists it.
    expect(chipValues(liveChipScene(sources()))('<ENTITIES|sublocations.name>')).toBe('Porter');
  });

  it('splits the participants into scene ids and ad-hoc names, dropping a cast member who lives elsewhere', () => {
    const scene = liveChipScene(sources({ participants: ['Harbormaster', 'the ferryman', 'Porter'] }));
    expect(scene.inSceneIds).toEqual(['harbormaster']);
    expect(scene.inSceneNames).toEqual(['the ferryman']);
    expect(chipValues(scene)('<ENTITIES|inscene.name>')).toBe('Harbormaster, the ferryman');
  });

  it('sends an entity’s pronouns resolved in its own scope', () => {
    const pronouned = { ...harbormaster, pronouns: '{{char}} goes by they/them' };
    const values = chipValues(liveChipScene(sources({
      entities: [pronouned], allEntities: [pronouned],
      resolveEntity: (_entity, text) => text.replaceAll('{{char}}', 'Harbormaster'),
    })));
    expect(values('<ENTITIES>')).toContain('Harbormaster goes by they/them');
    expect(values('<ENTITIES>')).not.toContain('{{char}}');
  });

  describe('relationship labels', () => {
    // Each owner reads its own roll for the Role chip; the world-level resolve reads another.
    const ROLE = '{{ph:role:world:p1}}';
    const roles: Record<string, string> = { wren: 'first mate', oar: 'rival', keel: '' };
    const labeled = (persona: Entity, played: Entity[]) => chipValues(liveChipScene(sources({
      persona: { source: 'world', entity: persona }, playedEntities: played,
      resolve: (text) => text.replaceAll(ROLE, 'stranger'),
      resolveEntity: (entity, text) => text.replaceAll(ROLE, roles[entity.id] ?? 'unknown'),
    })))('<PERSONA>') ?? '';
    const holds = (id: string, name: string): Entity => ({
      id, name, persona: true, relationships: [{ targetId: 'harbormaster', label: ROLE }],
    });

    it("resolves a played entity's label in its own scope when its line moves onto the persona's block", () => {
      const wren = holds('wren', 'Wren');
      expect(labeled(wren, [wren])).toContain("Harbormaster is Wren's first mate");
      const oar = holds('oar', 'Oar');
      const block = labeled({ id: 'wren', name: 'Wren', persona: true }, [{ id: 'wren', name: 'Wren', persona: true }, oar]);
      expect(block).toContain("Harbormaster is Wren's rival");
      expect(block).not.toContain('stranger');
    });

    it('prints no line for a label that resolves to blank', () => {
      const keel = holds('keel', 'Keel');
      expect(labeled(keel, [keel])).not.toContain('Harbormaster is');
    });
  });

  it("nests the Stats chip and each present entity's stats under their authored groups, headings resolved", () => {
    const nerve: StatGroup = { id: 'nerve', name: 'Nerve', aiDescription: 'Steady on {{deck}}.', parentId: null };
    const back: StatGroup = { id: 'back', name: 'Back', parentId: null };
    const load: PlayerStat = { ...grit, id: 'load', name: 'Load', description: '' };
    const hauler = { ...harbormaster, stats: [{ ...load, groupId: 'back' }], statGroups: [back] };
    // The live copy of Grit predates its grouping; the author's placement decides.
    const values = chipValues(liveChipScene(sources({
      statPlacement: { groups: [nerve], authored: [{ ...grit, groupId: 'nerve' }] },
      entities: [hauler, porter], allEntities: [hauler, porter], entityStats: { harbormaster: [load] },
    })));
    expect(values('<STATS DESCRIPTION|numbers.meaning.markdown>'))
      .toBe('- **Nerve:** Steady on a wet deck.\n  - **Grit:** 4/10 — Nerve.');
    expect(values('<ENTITIES>')).toContain('  stats:\n    Back:\n      Load: 4/10\n');
  });

  it('leaves out the heading of a group the AI cannot see and keeps its members, in every chip', () => {
    const nerve: StatGroup = { id: 'nerve', name: 'Nerve', aiDescription: 'Kept from the AI.', parentId: null, aiVisible: false };
    const back: StatGroup = { id: 'back', name: 'Back', parentId: null, aiVisible: false };
    const crew: TraitGroup = { id: 'crew', name: 'Crew', aiDescription: 'Also kept back.', parentId: null, aiVisible: false };
    const load: PlayerStat = { ...grit, id: 'load', name: 'Load', description: '' };
    const hauler = { ...harbormaster, stats: [{ ...load, groupId: 'back' }], statGroups: [back] };
    const values = chipValues(liveChipScene(sources({
      statPlacement: { groups: [nerve], authored: [{ ...grit, groupId: 'nerve' }] },
      traits: [{ ...seaLegs, groupId: 'crew' }], traitGroups: [crew],
      entities: [hauler, porter], allEntities: [hauler, porter], entityStats: { harbormaster: [load] },
    })));
    expect(values('<STATS DESCRIPTION|numbers.meaning.markdown>')).toBe('- **Grit:** 4/10 — Nerve.');
    expect(values('<TRAITS DESCRIPTION>')).toBe('Sea Legs: Steady on any deck.');
    expect(values('<ENTITIES>')).toContain('  stats:\n    Load: 4/10\n');
    expect(values('<ENTITIES>')).not.toContain('Back');
  });

  it('scopes the scene to the location a turn was routed to', () => {
    expect(liveChipScene(sources(), warehouse).presentIds).toEqual(['porter', 'stray']);
  });

  it('resolves a trait with its own pins before the scene resolves the rest', () => {
    const values = chipValues(liveChipScene(sources()));
    expect(values('<TRAITS DESCRIPTION>')).toContain('Steady on any deck.');
  });

  it('reads the stats, traits and resolution from a before box in flight, and nothing else from it', () => {
    const hardened: PlayerStat = { ...grit, value: 9 };
    const scene = liveChipScene(sources(), null, {
      activeStats: [hardened],
      activeTraits: [],
      ownedTraits: {},
      resolve: (text) => text.replaceAll('{{deck}}', 'the box deck'),
      resolveTrait: (_trait, text) => text,
      resolveEntity: (_entity, text) => text.replaceAll('{{char}}', 'the box hauler'),
    });
    expect(scene.stats).toEqual([hardened]);
    expect(scene.traits).toEqual([]);
    expect(scene.location).toBe(quay);
    expect(scene.resolve('{{deck}}')).toBe('the box deck');
    expect(scene.entities.find((e) => e.id === 'porter')?.aiDescription).toBe('the box hauler hauls crates.');
  });

  it("resolves each entity's text with that entity as the Character Name", () => {
    const scene = liveChipScene(sources({ location: warehouse }));
    expect(chipValues(scene)('<ENTITIES>')).toContain('Porter hauls crates.');
    expect(buildToolSnapshot(scene, []).world.entities.find((e) => e.id === 'porter'))
      .toMatchObject({ description: 'Porter hauls crates.', summary: 'Porter, a hauler.' });
  });

  it('hands the character pass a blurb with no raw chip in it', () => {
    const scene = liveChipScene(sources({ location: warehouse }));
    const entity = scene.entities.find((e) => e.id === 'porter');
    const message = buildCharacterUserMessage({ character: { name: 'Porter', entity }, scene: '', action: 'Wave.' });
    expect(message).toContain('My background (who I am in general, not this exact moment): Porter, a hauler.');
    expect(message).not.toContain('{{');
    const diary = buildDiaryUserMessage({ name: 'Porter', entity, narration: 'Porter waved.' });
    expect(diary).toContain('Porter, a hauler.');
    expect(diary).not.toContain('{{');
  });

  it("carries the played persona's name as the Persona Name, which a chip Header reads", () => {
    const header = '<PERSONA|markdown|header="{{user}} (Player Character)">';
    const wren: Entity = { id: 'wren', name: 'Wren', persona: true, aiDescription: 'Rows the ferry.' };
    const played = chipValues(liveChipScene(sources({ persona: { source: 'world', entity: wren } })));
    expect(played('header:{{user}}')).toBe('Wren');
    expect(renderPromptTemplate(header, played)).toMatch(/^\n## Wren \(Player Character\)\n- \*\*Wren\*\*/);
    // Prompt text never takes the Persona Name.
    expect(renderPromptTemplate('Speak to {{user}}.', played)).toBe('Speak to {{user}}.');
    const blank = chipValues(liveChipScene(sources({ persona: { source: 'library', entity: { ...wren, name: ' ' } } })));
    expect(blank('header:{{user}}')).toBe('');
    // With nobody played, the Header reads the player, and the Persona chip itself drops out.
    const none = chipValues(liveChipScene(sources()));
    expect(none('header:{{user}}')).toBe('the player');
    expect(renderPromptTemplate(`A${header}<NOTES|format=markdown|header="{{user}} notes">B`, layerValues(none, { '<NOTES>': 'Find the map.' })))
      .toBe('A\n## The Player Notes\nFind the map.\nB');
  });

  it("resolves the persona's own text with the persona as the Character Name", () => {
    const wren: Entity = { id: 'wren', name: 'Wren', persona: true, aiDescription: '{{char}} rows the ferry.' };
    const scene = liveChipScene(sources({ persona: { source: 'world', entity: wren } }));
    expect(chipValues(scene)('<PERSONA>')).toContain('Wren rows the ferry.');
  });

  describe('entity stats', () => {
    const trust: PlayerStat = { ...grit, id: 'trust', name: 'Trust', value: 6 };
    const off: PlayerStat = { ...grit, id: 'dread', name: 'Dread', enabled: false };

    it('carries each entity’s switched-on stats at their live values, and drops a switched-off one', () => {
      const scene = liveChipScene(sources({ entityStats: { harbormaster: [trust, off] } }));
      expect(scene.ownedStats).toEqual({ harbormaster: [trust] });
      expect(chipValues(scene)('<ENTITIES>')).toContain('Trust: 6/10');
      expect(chipValues(scene)('<ENTITIES>')).not.toContain('Dread');
    });

    it('switches an entity’s stats with its own traits in force', () => {
      // Grim switches Trust off and Dread on, while the harbormaster holds it.
      const grim: Trait = { id: 'grim', name: 'Grim', statChanges: [], statToggles: [{ statId: 'trust', enabled: false }, { statId: 'dread', enabled: true }] };
      const holding = (disabled: string[]) => liveChipScene(sources({
        entityStats: { harbormaster: [trust, off] },
        owners: [{ id: 'harbormaster', traits: [grim], groups: [] }],
        ownedTraits: { harbormaster: { chosen: ['grim'], disabled } },
      }));
      expect(holding([]).ownedStats?.harbormaster.map((s) => s.name)).toEqual(['Dread']);
      expect(holding(['grim']).ownedStats?.harbormaster.map((s) => s.name)).toEqual(['Trust']);
    });

    it('reads the stats a before box wrote, in place of the committed ones', () => {
      const moved: PlayerStat = { ...trust, value: 9 };
      const scene = liveChipScene(sources({ entityStats: { harbormaster: [trust] } }), null, {
        activeStats: [grit], activeTraits: [], ownedTraits: {}, entityStats: { harbormaster: [moved] },
        resolve: (text) => text, resolveTrait: (_trait, text) => text, resolveEntity: (_entity, text) => text,
      });
      expect(scene.ownedStats).toEqual({ harbormaster: [moved] });
    });

    it('holds none for a playthrough with no entity stats', () => {
      expect(chipValues(liveChipScene(sources()))('<ENTITIES>')).not.toContain('stats:');
    });

    describe('in the character pass', () => {
      // The previous turn moved Trust from its authored 6 to 9.
      const ledger: Entity = { ...harbormaster, stats: [trust] };
      const scene = liveChipScene(sources({
        entities: [ledger, porter], allEntities: [ledger, porter],
        entityStats: { harbormaster: [{ ...trust, value: 9, description: 'Calm on {{deck}}.' }] },
      }));
      const brief = (name: string, entity?: Entity) => buildCharacterUserMessage({
        character: { name, entity }, stats: entityStatsField(scene, entity), scene: '', action: 'Wave.',
      });

      it("gives a character its own stats after its background, as the narration's Entities chip gives them", () => {
        const field = entityStatsField(scene, ledger);
        expect(field).toContain('**Trust:** 9/10');
        expect(field).toContain('Calm on a wet deck.');
        expect(chipValues(scene)('<ENTITIES|markdown>')).toContain(field);
        expect(brief('Harbormaster', ledger)).toContain(`not this exact moment): Keeps the ledger.\n${field.trimEnd()}\n\n`);
      });

      it('gives no stats field to a character with no stats, or to one the director introduced', () => {
        expect(entityStatsField(scene, porter)).toBe('');
        expect(brief('Porter', porter)).not.toContain('stats');
        expect(entityStatsField(scene, undefined)).toBe('');
        expect(brief('the ferryman')).not.toContain('stats');
        // The builder holds the same rule: a field handed to an ad-hoc character stays out.
        const adHoc = buildCharacterUserMessage({
          character: { name: 'the ferryman' }, stats: entityStatsField(scene, ledger), scene: '', action: 'Wave.',
        });
        expect(adHoc).not.toContain('stats');
      });
    });

    describe('of the entities the player plays as', () => {
      const mind: StatGroup = { id: 'mind', name: 'Mind', parentId: null };
      const calm: PlayerStat = { ...grit, id: 'calm', name: 'Calm', value: 7, groupId: 'mind' };
      const veiled: PlayerStat = { ...grit, id: 'veiled', name: 'Veiled', value: 2, hidden: true };
      const wren: Entity = { id: 'wren', name: 'Wren', persona: true, stats: [calm, veiled, off], statGroups: [mind] };
      const playing = (over: Partial<LiveSceneSources> = {}) => liveChipScene(sources({
        playedEntities: [wren], entityStats: { wren: [calm, veiled, off], harbormaster: [trust] }, ...over,
      }));

      it("lists their switched-on stats after the world's, hidden ones included, placed by their own groups", () => {
        expect(chipValues(playing())('<STATS DESCRIPTION|numbers>')).toBe('Grit: 4/10\nVeiled: 2/10\nMind:\n  Calm: 7/10');
      });

      it('switches their stats with their own traits in force', () => {
        const stirred: Trait = { id: 'stirred', name: 'Stirred', statChanges: [], statToggles: [{ statId: 'dread', enabled: true }] };
        const scene = playing({ owners: [{ id: 'wren', traits: [stirred], groups: [] }], ownedTraits: { wren: { chosen: ['stirred'] } } });
        expect(chipValues(scene)('<STATS DESCRIPTION|numbers>')).toContain('Dread: 4/10');
      });

      it('reads the values a before box wrote', () => {
        const scene = liveChipScene(sources({ playedEntities: [wren], entityStats: { wren: [calm] } }), null, {
          activeStats: [grit], activeTraits: [], ownedTraits: {}, entityStats: { wren: [{ ...calm, value: 9 }] },
          resolve: (text) => text, resolveTrait: (_trait, text) => text, resolveEntity: (_entity, text) => text,
        });
        expect(chipValues(scene)('<STATS DESCRIPTION|numbers>')).toContain('Calm: 9/10');
      });

      it("leaves a cast member's stats out of the Stats chip", () => {
        expect(chipValues(playing())('<STATS DESCRIPTION|numbers>')).not.toContain('Trust');
      });

      it("nests the persona's own stats in its block at their live values, and leaves the world's in the Stats chip", () => {
        const scene = liveChipScene(sources({
          persona: { source: 'world', entity: wren }, playedEntities: [wren], entityStats: { wren: [calm, veiled, off] },
        }), null, {
          activeStats: [grit], activeTraits: [], ownedTraits: {}, entityStats: { wren: [{ ...calm, value: 9 }, veiled, off] },
          resolve: (text) => text, resolveTrait: (_trait, text) => text, resolveEntity: (_entity, text) => text,
        });
        const values = chipValues(scene);
        expect(values('<STATS DESCRIPTION|numbers>')).toBe('Grit: 4/10');
        expect(values('<PERSONA>')).toContain('  stats:\n    Veiled: 2/10');
        expect(values('<PERSONA>')).toContain('    Mind:\n      Calm: 9/10');
        expect(values('<PERSONA>')).not.toContain('Dread');
      });
    });
  });

  describe('owned traits', () => {
    const loyal: Trait = { id: 'loyal', name: 'Loyal', aiDescription: '{{char}} stands by the player.', statChanges: [] };
    const sullen: Trait = { id: 'sullen', name: 'Sullen', aiDescription: '{{char}} answers in grunts.', statChanges: [] };
    const owned = entities.map((e) => (e.id === 'harbormaster' ? { ...e, traits: [loyal, sullen] } : e));
    const cast = sources({ entities: owned, allEntities: [...owned, stray] });

    it("gives an NPC its chosen traits minus the ones switched off, each resolved with its owner", () => {
      const values = chipValues(liveChipScene({
        ...cast, ownedTraits: { harbormaster: { chosen: ['loyal', 'sullen'], disabled: ['sullen'] } },
      }));
      expect(values('<ENTITIES>')).toContain('Loyal: Harbormaster stands by the player.');
      expect(values('<ENTITIES>')).not.toContain('Sullen');
      expect(values('<ENTITIES|summary>')).toContain('traits: Loyal');
    });

    it("reads an NPC's traits from a before box in flight", () => {
      const chosen = { ...cast, ownedTraits: { harbormaster: { chosen: ['loyal'] } } };
      const scene = liveChipScene(chosen, null, {
        activeStats: [grit], activeTraits: [seaLegs], ownedTraits: { harbormaster: { chosen: ['loyal'], disabled: ['loyal'] } },
        resolve: (text) => text, resolveTrait: (_trait, text) => text, resolveEntity: (_entity, text) => text,
      });
      expect(chipValues(scene)('<ENTITIES>')).not.toContain('Loyal');
    });

    it('gives an NPC nothing when the playthrough chose none of its traits', () => {
      expect(chipValues(liveChipScene(cast))('<ENTITIES>')).not.toContain('traits');
    });

    it("renders the played entity's owned traits in the Persona chip, resolved for it", () => {
      const scar: Trait = { id: 'scar', name: 'Scarred', aiDescription: '{{char}} carries a scar.', statChanges: [] };
      const wren: Entity = { id: 'wren', name: 'Wren', persona: true, aiDescription: 'Rows the ferry.', traits: [scar] };
      const values = chipValues(liveChipScene({
        ...cast, persona: { source: 'world', entity: wren }, ownedTraits: { wren: { chosen: ['scar'] } },
      }));
      expect(values('<TRAITS DESCRIPTION>')).toBe('Sea Legs: Steady on any deck.');
      expect(values('<PERSONA>')).toContain('  traits:\n    Scarred: Wren carries a scar.');
    });
  });

  describe('linked traits', () => {
    const blueprints: TraitGroup = { id: 'blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' };
    const paladin: Trait = {
      id: 'paladin', name: 'Paladin', groupId: 'blueprints', aiDescription: '{{char}} swore the oath.', statChanges: [],
    };
    const link = (id: string): TraitLink => ({ id, originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null });
    const albus: Entity = { id: 'albus', name: 'Albus', locations: ['quay'], aiDescription: 'A knight.', traitLinks: [link('l1')] };
    const wren: Entity = { id: 'wren', name: 'Wren', persona: true, aiDescription: 'Rows the ferry.', traitLinks: [link('l2')] };
    const newcomer: Entity = { id: 'cp', name: 'Newcomer', customPersona: true, traitLinks: [link('l3')] };
    const world: OwnerWorld = { traits: [paladin], traitGroups: [blueprints], entities: [albus, wren, newcomer] };
    // Global scope's tree and each entity owner's, as play hands them to the scene.
    const trees = (w: OwnerWorld, ref: PersonaRef | undefined) => {
      const { global, owners } = resolveOwners(w, ref);
      return { global, owners };
    };
    const real = (persona: LiveSceneSources['persona'], over: Partial<LiveSceneSources> = {}) => sources({
      entities: [albus], allEntities: [albus], persona, traits: [], traitGroups: [blueprints],
      ...trees(world, persona ? { source: 'world', entityId: persona.entity.id } : undefined),
      resolveTrait: (_trait, text, owner) => resolveOwnerText(owner ?? null, text, {
        placeholders: [], rolls: {}, player: { name: persona?.entity.name },
      }),
      ...over,
    });

    it("gives a cast entity its active linked trait in full, with the entity as the Character Name", () => {
      const values = chipValues(liveChipScene(real(null, { ownedTraits: { albus: { chosen: ['paladin'] } } })));
      expect(values('<ENTITIES>')).toContain('Paladin: Albus swore the oath.');
      expect(values('<ENTITIES|summary>')).toContain('traits: Paladin');
    });

    it('leaves out a linked trait the playthrough has not chosen', () => {
      expect(chipValues(liveChipScene(real(null)))('<ENTITIES>')).not.toContain('Paladin');
    });

    it("renders the played world persona's linked trait in the Persona chip, named for the persona", () => {
      const values = chipValues(liveChipScene(real({ source: 'world', entity: wren }, { ownedTraits: { wren: { chosen: ['paladin'] } } })));
      expect(values('<PERSONA>')).toContain('  traits:\n    Paladin: Wren swore the oath.');
    });

    it("names the player in the player's group text", () => {
      const oaths: TraitGroup = { id: 'oaths', name: 'Oaths', aiDescription: '{{char}} is sworn.', parentId: null };
      const sworn: Trait = { id: 'sworn', name: 'Sworn', groupId: 'oaths', statChanges: [] };
      const grouped = { ...world, traits: [sworn], traitGroups: [oaths] };
      const values = chipValues(liveChipScene(real(null, {
        traits: [sworn], traitGroups: [oaths], ...trees(grouped, undefined), resolve: (text) =>
          resolveEntityText(null, text, { placeholders: [], rolls: {} }),
      })));
      expect(values('<TRAITS DESCRIPTION>')).toBe('Oaths:\n  The player is sworn.\n  Sworn');
    });

    it('keys a Custom Persona entity’s linked trait by the entity under None, apart from the root traits', () => {
      const scene = liveChipScene(real(null, { ownedTraits: { cp: { chosen: ['paladin'] } } }));
      expect(scene.ownedTraits).toEqual({ cp: ['paladin'] });
      expect(scene.traits).toEqual([]);
      expect(scene.traitGroups).toEqual([]);
    });
  });

  it('carries no lore, since activation is per turn', () => {
    expect(liveChipScene(sources()).lore).toEqual([]);
  });

  describe('a clock the turn advanced', () => {
    const at10 = { elapsed: 10, calendar: { startHour: 0 } };

    it('reads the advanced time on the Time chip, the rest of the scene live', () => {
      const values = chipValues(liveChipScene(sources({ time: at10 }), null, { elapsed: 18 }));
      expect(values('<TIME>')).toBe('Day 1, evening');
      expect(values('<STATS>')).toBe(chipValues(liveChipScene(sources({ time: at10 })))('<STATS>'));
    });

    it('keeps the Time chip empty while the clock is off', () => {
      expect(liveChipScene(sources(), null, { elapsed: 18 }).time).toBeNull();
    });
  });
});
