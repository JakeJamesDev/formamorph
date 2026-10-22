import { describe, it, expect } from 'vitest';
import { chipValues, sceneEntityChipValues } from './chipValues';
import type { ChipScene } from './chipScene';
import { spelledTokens } from '@/test/chipTokens';
import type { Entity, GameLocation, PlayerStat, Trait } from '@/types';
import { YOU_TARGET } from '../entityRelationships';
import type { ResolvedPersona } from '../persona';

// Old Town holds the North Gate and the Market; the North Gate holds the Gatehouse. The scene is at the North
// Gate: the Guard is here, the Merchant is in a sub-location, the Watchman is reachable, the Wanderer is nowhere.
const oldTown: GameLocation = { id: 'old-town', name: 'Old Town', aiDescription: 'Terraced streets.' };
const northGate: GameLocation = { id: 'north-gate', name: 'North Gate', parentId: 'old-town', aiDescription: 'A stone gate.' };
const gatehouse: GameLocation = { id: 'gatehouse', name: 'Gatehouse', parentId: 'north-gate', aiDescription: 'A guard room.' };
const market: GameLocation = { id: 'market', name: 'Market', parentId: 'old-town', aiDescription: 'Stalls under canvas.' };
const locations = [oldTown, northGate, gatehouse, market];

const guard: Entity = { id: 'guard', name: 'Guard', type: 'person', locations: ['north-gate'], aiDescription: 'A burly guard.' };
const merchant: Entity = { id: 'merchant', name: 'Merchant', locations: ['gatehouse'], aiDescription: 'Sells maps.' };
const watchman: Entity = { id: 'watchman', name: 'Watchman', locations: ['market'], aiDescription: 'Walks the stalls.' };
const wanderer: Entity = { id: 'wanderer', name: 'Wanderer', aiDescription: 'Came in with the caravan.' };
const herald: Entity = { id: 'herald', name: 'Herald', knownIn: ['old-town'], aiSummary: 'Reads the decrees.' };

const scene = (entities: Entity[], over: Partial<ChipScene> = {}): ChipScene => ({
  overview: '', stats: [], traits: [], traitGroups: [], persona: null,
  location: northGate, locations, connections: [], entities,
  presentIds: ['guard'], inSceneIds: ['guard'], lore: [], notes: '', time: null,
  resolve: (text) => text,
  ...over,
});

const holding = (entity: Entity, ...relationships: [string, string][]): Entity => ({
  ...entity, relationships: relationships.map(([targetId, label]) => ({ targetId, label })),
});

const LINE = "Merchant is Guard's brother";

describe('relationship lines in the Entities chip', () => {
  const cast = [holding(guard, ['merchant', 'brother']), merchant, watchman, wanderer];

  it('reads as "<target> is <owner>\'s <label>" in each format', () => {
    const values = chipValues(scene(cast));
    expect(values('<ENTITIES>')).toContain(`  relationship: ${LINE}\n`);
    expect(values('<ENTITIES|markdown>')).toContain(`  - **relationship:** ${LINE}\n`);
    expect(values('<ENTITIES|xml>')).toContain(`  <relationship>${LINE}</relationship>\n`);
    expect(values('<ENTITIES|summary>')).toContain(`  relationship: ${LINE}\n`);
  });

  it('prints on the owner’s block, and not again on the target’s', () => {
    const values = chipValues(scene(cast));
    expect(values('<ENTITIES|sublocations>')).toContain('Merchant');
    expect(values('<ENTITIES|sublocations>')).not.toContain('relationship');
  });

  it('prints on the target’s block when the owner renders in no scope', () => {
    // The Watchman is reachable, so it pulls no one in, and the Wanderer stays unlisted.
    const values = chipValues(scene([guard, merchant, watchman, holding(wanderer, ['watchman', 'sister'])]));
    expect(values('<ENTITIES|reachable>')).toContain("  relationship: Watchman is Wanderer's sister\n");
  });

  it('prints on the owner’s block in a lower scope', () => {
    const values = chipValues(scene([guard, merchant, holding(watchman, ['guard', 'captain']), wanderer]));
    expect(values('<ENTITIES|reachable>')).toContain("  relationship: Guard is Watchman's captain\n");
    expect(values('<ENTITIES>')).not.toContain('relationship');
  });

  it('prints on a known entity’s block', () => {
    const values = chipValues(scene([guard, merchant, watchman, wanderer, holding(herald, ['wanderer', 'cousin'])]));
    expect(values('<ENTITIES|known>')).toContain("  relationship: Wanderer is Herald's cousin\n");
  });

  it('prints nowhere when neither end renders', () => {
    const hidden: Entity = { ...herald, knownIn: 'nowhere' };
    const values = chipValues(scene([guard, merchant, watchman, holding(wanderer, ['herald', 'uncle']), hidden], { inSceneIds: ['guard', 'merchant'] }));
    for (const token of ['<ENTITIES>', '<ENTITIES|sublocations>', '<ENTITIES|reachable>', '<ENTITIES|known>', '<ENTITIES|inscene>']) {
      expect(values(token), token).not.toContain('uncle');
    }
  });

  it('applies the rule over the In Scene ids on their own', () => {
    // The Wanderer is in the scene but in no location scope.
    const values = chipValues(scene([guard, merchant, watchman, holding(wanderer, ['guard', 'sister'])], { inSceneIds: ['guard', 'wanderer'] }));
    const inScene = values('<ENTITIES|inscene>')!;
    expect(inScene.match(/relationship/g)).toHaveLength(1);
    expect(inScene.indexOf("Guard is Wanderer's sister")).toBeGreaterThan(inScene.indexOf('Wanderer\n'));
    // The location chain has the Guard only, so Here prints it on the Guard.
    expect(values('<ENTITIES>')).toContain("Guard is Wanderer's sister");
  });

  it('prints in the Choices scene-roster override', () => {
    expect(sceneEntityChipValues(scene(cast), ['guard', 'merchant'])('<ENTITIES>')!.match(/relationship/g)).toHaveLength(1);
  });

  it('shows no line in a Name content', () => {
    const values = chipValues(scene(cast, { inSceneIds: ['guard'] }));
    expect(values('<ENTITIES|name>')).toBe('Guard');
    expect(values('<ENTITIES|inscene.name>')).toBe('Guard');
  });

  it('lists each relationship in author order, after the description and type, before traits and stats', () => {
    const oath: Trait = { id: 'oath', name: 'Sworn', aiDescription: 'Bound to the gate.', statChanges: [] };
    const grit: PlayerStat = { id: 'grit', name: 'Grit', type: 'number', description: 'Will to go on.', descriptors: [], min: 0, max: 10, value: 4, regen: 0 };
    const sworn = { ...holding(guard, ['watchman', 'friend'], ['merchant', 'brother']), traits: [oath] };
    const value = chipValues(scene([sworn, merchant, watchman, wanderer], {
      ownedTraits: { guard: ['oath'] }, ownedStats: { guard: [grit] },
    }))('<ENTITIES>')!;
    const at = (text: string) => value.indexOf(text);
    expect(at('type: person')).toBeGreaterThan(at('description: A burly guard.'));
    expect(at("Watchman is Guard's friend")).toBeGreaterThan(at('type: person'));
    expect(at(LINE)).toBeGreaterThan(at("Watchman is Guard's friend"));
    expect(at('traits:')).toBeGreaterThan(at(LINE));
    expect(at('stats:')).toBeGreaterThan(at(LINE));
  });

  it('skips a row whose target is gone or whose label is blank', () => {
    const values = chipValues(scene([holding(guard, ['gone', 'twin'], ['merchant', '  ']), merchant, watchman, wanderer]));
    for (const token of ['<ENTITIES>', '<ENTITIES|sublocations>']) expect(values(token), token).not.toContain('relationship');
  });

  it('prints one row of a mirrored pair, the one held earlier in the world', () => {
    const brother = holding(guard, ['merchant', 'brother']);
    const sister = holding(merchant, ['guard', 'sister']);
    for (const [cast, kept, dropped] of [
      [[brother, sister, watchman, wanderer], LINE, "Guard is Merchant's sister"],
      [[sister, brother, watchman, wanderer], "Guard is Merchant's sister", LINE],
    ] as const) {
      const values = chipValues(scene([...cast], { inSceneIds: ['guard', 'merchant'] }));
      for (const token of ['<ENTITIES>', '<ENTITIES|sublocations>', '<ENTITIES|inscene>']) {
        expect(values(token), token).not.toContain(dropped);
      }
      expect(values('<ENTITIES>')! + values('<ENTITIES|sublocations>')!).toContain(kept);
      expect(values('<ENTITIES|inscene>')!.match(/relationship/g)).toHaveLength(1);
    }
  });

  it('prints both rows of a pair when the earlier one has a blank label', () => {
    const values = chipValues(scene([holding(guard, ['merchant', ' ']), holding(merchant, ['guard', 'sister']), watchman, wanderer]));
    expect(values('<ENTITIES>')! + values('<ENTITIES|sublocations>')!).toContain("Guard is Merchant's sister");
  });

  it('renders a world with empty relationship lists byte-equal to one without', () => {
    const bare = chipValues(scene([guard, merchant, watchman, wanderer, herald], { inSceneIds: ['guard', 'wanderer'] }));
    const empty = chipValues(scene([guard, merchant, watchman, wanderer, herald].map((e) => ({ ...e, relationships: [] })), {
      inSceneIds: ['guard', 'wanderer'],
    }));
    for (const token of spelledTokens('<ENTITIES>')) expect(empty(token), token).toBe(bare(token));
  });
});

describe('the known roster pull-in', () => {
  // Kate is nowhere and known nowhere, so only a relationship can make her known.
  const kate: Entity = {
    id: 'kate', name: 'Kate', knownIn: 'nowhere', aiSummary: 'Runs the inn.', aiDescription: 'A stern innkeeper.', traits: [],
  };
  const known = (values: ReturnType<typeof chipValues>) => values('<ENTITIES|known>')!;

  it('pulls the target of a relationship held here into the known roster', () => {
    const values = chipValues(scene([holding(guard, ['kate', 'mother']), merchant, watchman, wanderer, kate]));
    expect(known(values)).toMatch(/^Kate$/m);
    expect(known(values)).toContain('Runs the inn.');
    // The line prints once, on the owner's block.
    expect(values('<ENTITIES>')).toContain("relationship: Kate is Guard's mother");
    expect(known(values)).not.toContain('relationship');
  });

  it('pulls the owner of a relationship that targets an entity here', () => {
    const values = chipValues(scene([guard, merchant, watchman, wanderer, holding(kate, ['guard', 'son'])]));
    expect(known(values)).toMatch(/^Kate$/m);
    expect(known(values)).toContain("relationship: Guard is Kate's son");
    expect(values('<ENTITIES>')).not.toContain('relationship');
  });

  it('pulls from the In Scene roster', () => {
    // The Wanderer is in the scene but in no location scope.
    const values = chipValues(scene([guard, merchant, watchman, holding(wanderer, ['kate', 'aunt']), kate], { inSceneIds: ['guard', 'wanderer'] }));
    expect(known(values)).toMatch(/^Kate$/m);
  });

  it('pulls no one from the sub-location, reachable or known rosters', () => {
    for (const owner of [merchant, watchman, herald]) {
      const cast = [guard, merchant, watchman, wanderer, herald, kate].map((e) => (e.id === owner.id ? holding(e, ['kate', 'mother']) : e));
      expect(known(chipValues(scene(cast))), owner.name).not.toMatch(/^Kate$/m);
    }
  });

  it('renders a pulled entity by summary only, with no traits or stats', () => {
    const oath: Trait = { id: 'oath', name: 'Sworn', aiDescription: 'Bound to the inn.', statChanges: [] };
    const grit: PlayerStat = { id: 'grit', name: 'Grit', type: 'number', description: 'Will to go on.', descriptors: [], min: 0, max: 10, value: 4, regen: 0 };
    const values = chipValues(scene([holding(guard, ['kate', 'mother']), merchant, watchman, wanderer, { ...kate, traits: [oath] }], {
      ownedTraits: { kate: ['oath'] }, ownedStats: { kate: [grit] },
    }));
    expect(known(values)).toContain('Runs the inn.');
    expect(known(values)).not.toContain('A stern innkeeper.');
    expect(known(values)).not.toContain('Sworn');
    expect(known(values)).not.toContain('Grit');
  });

  it('leaves a pulled entity that a higher scope lists in that scope', () => {
    const values = chipValues(scene([holding(guard, ['watchman', 'friend'], ['merchant', 'brother']), merchant, watchman, wanderer]));
    expect(values('<ENTITIES|reachable>')).toContain('Watchman');
    expect(values('<ENTITIES|sublocations>')).toContain('Merchant');
    expect(known(values)).not.toContain('Watchman');
    expect(known(values)).not.toContain('Merchant');
  });

  it('pulls from the In Scene roster when the scene has no location', () => {
    const at = (cast: Entity[]) => known(chipValues(scene(cast, { location: null, presentIds: [] })));
    expect(at([holding(guard, ['kate', 'mother']), kate])).toMatch(/^Kate$/m);
    expect(at([guard, kate])).toBe('N/A');
  });

  it('pulls one hop only', () => {
    // Kate is pulled in, and the Wanderer is related only to Kate.
    const values = chipValues(scene([holding(guard, ['kate', 'mother']), merchant, watchman, wanderer, holding(kate, ['wanderer', 'lodger'])]));
    expect(known(values)).toMatch(/^Kate$/m);
    expect(known(values)).not.toMatch(/^Wanderer$/m);
  });

  it('never lists an In Scene entity as known', () => {
    // The Wanderer is in the scene but in no location scope, and related to the Guard here.
    const values = chipValues(scene([holding(guard, ['wanderer', 'cousin']), merchant, watchman, wanderer], { inSceneIds: ['guard', 'wanderer'] }));
    expect(known(values)).toBe('N/A');
    expect(values('<ENTITIES>')).toContain("Wanderer is Guard's cousin");
  });

  it('pulls no one through a row with a blank label', () => {
    expect(known(chipValues(scene([holding(guard, ['kate', '  ']), merchant, watchman, wanderer, kate])))).not.toMatch(/^Kate$/m);
  });

  it('never pulls in the Custom Persona', () => {
    const custom: Entity = { id: 'custom', name: 'Custom', customPersona: true, aiSummary: 'A newcomer.' };
    expect(known(chipValues(scene([holding(guard, ['custom', 'ward']), merchant, watchman, wanderer, custom])))).not.toContain('Custom');
  });

  it('lists a pulled entity once beside one known by place, in world order', () => {
    const values = chipValues(scene([holding(guard, ['herald', 'uncle'], ['kate', 'mother']), merchant, watchman, wanderer, herald, kate]));
    const roster = known(values);
    expect(roster.match(/Herald/g)).toHaveLength(1);
    expect(roster.search(/^Kate$/m)).toBeGreaterThan(roster.search(/^Herald$/m));
  });
});

describe('You and the persona rules', () => {
  // Kate is nowhere and known nowhere, so only a relationship can make her known. Rowan and Mara are
  // persona-only world personas; the Custom Persona entity stands in under None and a library persona.
  const kate: Entity = { id: 'kate', name: 'Kate', knownIn: 'nowhere', aiSummary: 'Runs the inn.' };
  const rowan: Entity = { id: 'rowan', name: 'Rowan', persona: true, personaOnly: true, aiDescription: 'A courier.' };
  const mara: Entity = { id: 'mara', name: 'Mara', persona: true, personaOnly: true, aiSummary: 'A smuggler.' };
  const custom: Entity = { id: 'custom', name: 'Newcomer', customPersona: true, aiDescription: 'Just arrived.' };
  const ash: Entity = { id: 'lib-ash', name: 'Ash', aiDescription: 'From the library.' };

  type PersonaPick = 'world' | 'library' | 'none';
  const PICKS: PersonaPick[] = ['world', 'library', 'none'];
  const PLAYED_NAME: Record<PersonaPick, string> = { world: 'Rowan', library: 'Ash', none: 'Wren' };

  /** A scene as play builds it under `pick`: the cast lacks the played entities, which ride as the persona and
   *  the played list. Mara stays in the cast, unplayed, as the authored scene keeps her. */
  const played = (cast: Entity[], pick: PersonaPick, over: Partial<ChipScene> = {}): ChipScene => {
    const byId = (e: Entity) => cast.find((c) => c.id === e.id) ?? e;
    const persona: ResolvedPersona = pick === 'world' ? { entity: byId(rowan), source: 'world' }
      : pick === 'library' ? { entity: ash, source: 'library' }
        : { entity: { ...byId(custom), name: 'Wren' }, source: 'custom' };
    const playedEntities = pick === 'library' ? [byId(custom)] : [persona.entity];
    const playedIds = new Set(playedEntities.map((e) => e.id));
    return scene(cast.filter((e) => !playedIds.has(e.id)), { persona, playedEntities, ...over });
  };
  const base = [guard, merchant, watchman, wanderer];
  const you = (label: string): [string, string] => [YOU_TARGET, label];

  it.each(PICKS)('reads You as the played persona’s name, under %s', (pick) => {
    const values = chipValues(played([...base, holding(kate, you('son')), rowan, mara, custom], pick));
    expect(values('<PERSONA>')).toContain(`relationship: ${PLAYED_NAME[pick]} is Kate's son`);
    for (const token of spelledTokens('<ENTITIES>')) expect(values(token), token).not.toMatch(/\byou\b/i);
  });

  it.each(PICKS)('prints a line that touches the persona on the Persona block only, under %s', (pick) => {
    // Kate is here and in the scene, so every roster could print the line.
    const values = chipValues(played([...base, { ...holding(kate, you('son')), locations: ['north-gate'] }, rowan, mara, custom], pick, {
      presentIds: ['guard', 'kate'], inSceneIds: ['guard', 'kate'],
    }));
    expect(values('<PERSONA>')!.match(/relationship/g)).toHaveLength(1);
    for (const token of spelledTokens('<ENTITIES>')) expect(values(token), token).not.toContain("Kate's son");
  });

  it.each(PICKS)('pulls the persona’s relatives into the known roster in every scene, under %s', (pick) => {
    const values = chipValues(played([...base, holding(kate, you('mother')), rowan, mara, custom], pick, { presentIds: [], inSceneIds: [] }));
    expect(values('<ENTITIES|known>')).toMatch(/^Kate$/m);
    expect(values('<ENTITIES|known>')).not.toContain('relationship');
  });

  it.each(PICKS)('drops a relationship with an unplayed persona-only end, line and pull-in, under %s', (pick) => {
    // Mara is never played here; the Guard is here, and Kate's only tie is to Mara.
    const values = chipValues(played([
      holding(guard, ['mara', 'sister']), merchant, watchman, wanderer, holding(kate, ['mara', 'aunt']), rowan, mara, custom,
    ], pick));
    for (const token of [...spelledTokens('<ENTITIES>'), '<PERSONA>']) expect(values(token), token).not.toMatch(/sister|aunt/);
    expect(values('<ENTITIES|known>')).not.toMatch(/^Mara$/m);
  });

  it('renders a relationship with a persona-only entity once it is the one played', () => {
    const values = chipValues(scene([holding(guard, ['mara', 'sister']), merchant, watchman, wanderer, rowan], {
      persona: { entity: mara, source: 'world' }, playedEntities: [mara],
    }));
    expect(values('<PERSONA>')).toContain("relationship: Mara is Guard's sister");
    expect(values('<ENTITIES>')).not.toContain('relationship');
  });

  it('renders the played world persona’s own relationships, and pulls their targets in', () => {
    const values = chipValues(played([...base, kate, holding(rowan, ['kate', 'mother']), mara, custom], 'world', { presentIds: [], inSceneIds: [] }));
    expect(values('<PERSONA>')).toContain("relationship: Kate is Rowan's mother");
    expect(values('<ENTITIES|known>')).toMatch(/^Kate$/m);
  });

  it.each([['library', 'Ash'], ['none', 'Wren']] as const)('renders the Custom Persona entity’s relationships as the player’s, under %s', (pick, name) => {
    const values = chipValues(played([...base, kate, rowan, mara, holding(custom, ['kate', 'aunt'])], pick, { presentIds: [], inSceneIds: [] }));
    expect(values('<PERSONA>')).toContain(`relationship: Kate is ${name}'s aunt`);
    expect(values('<ENTITIES|known>')).toMatch(/^Kate$/m);
  });

  it('drops the Custom Persona entity’s relationships under a world persona', () => {
    const values = chipValues(played([
      holding(guard, ['custom', 'ward']), merchant, watchman, wanderer, kate, rowan, mara, holding(custom, ['kate', 'aunt']),
    ], 'world'));
    for (const token of [...spelledTokens('<ENTITIES>'), '<PERSONA>']) expect(values(token), token).not.toMatch(/ward|aunt/);
    expect(values('<ENTITIES|known>')).not.toMatch(/^Kate$/m);
  });

  it('drops every You row, line and pull-in, when nobody plays', () => {
    const values = chipValues(scene([holding(guard, you('ward')), merchant, watchman, wanderer, holding(kate, you('son'))]));
    for (const token of spelledTokens('<ENTITIES>')) expect(values(token), token).not.toMatch(/\b(ward|son)\b/);
    expect(values('<PERSONA>')).toBe('N/A');
  });

  it('drops a You row that reads as its own owner, and renders it under another persona', () => {
    const cast = [...base, kate, holding(rowan, you('rival')), mara, custom];
    expect(chipValues(played(cast, 'world'))('<PERSONA>')).not.toContain('rival');
    const asMara = chipValues(scene(cast.filter((e) => e.id !== 'mara').map((e) => (e.id === 'rowan' ? { ...e, personaOnly: false } : e)), {
      persona: { entity: mara, source: 'world' }, playedEntities: [mara],
    }));
    expect(asMara('<PERSONA>')).toContain("relationship: Mara is Rowan's rival");
  });

  it.each(PICKS)('prints the persona’s row of a mirrored pair, under %s', (pick) => {
    // Kate comes first in the world, so only the persona rule keeps the persona's row.
    const player = pick === 'world' ? 'rowan' : 'custom';
    const cast = [holding(kate, you('son')), ...base, rowan, mara, custom]
      .map((e) => (e.id === player ? holding(e, ['kate', 'mother']) : e));
    const persona = chipValues(played(cast, pick, { presentIds: [], inSceneIds: [] }))('<PERSONA>')!;
    expect(persona).toContain(`relationship: Kate is ${PLAYED_NAME[pick]}'s mother`);
    expect(persona).not.toContain("Kate's son");
  });

  it('prints one line when a You row and a row to the played persona meet, the named row winning', () => {
    for (const rows of [[you('ward'), ['rowan', 'nephew']], [['rowan', 'nephew'], you('ward')]] as [string, string][][]) {
      const values = chipValues(played([holding(guard, ...rows), merchant, watchman, wanderer, rowan, mara, custom], 'world'));
      const persona = values('<PERSONA>')!;
      expect(persona.match(/relationship/g)).toHaveLength(1);
      expect(persona).toContain("relationship: Rowan is Guard's nephew");
    }
  });
});
