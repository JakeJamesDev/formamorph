import { describe, expect, it } from 'vitest';
import type { Entity, EntityStatValues, PersonaRef, PlayerStat, StatGroup } from '@/types';
import { defaultStatUpdatesPrompt, defaultStatUpdatesUserPrompt, textStatUpdatesPrompt, textStatUpdatesUserPrompt } from '@/components/game/GamePrompts';
import {
  createStatRequest, keyedScene, readStatResponse, statRequestSchema, statResponseChanges, GLOBAL_STATS_HEADING, PLAYER_STAT_HEADING,
  type StatRequestSnapshot,
} from './statRequest';
import {
  applyEntityStatResponse, entityCodeTurns, entityStatDeltas, entityStatOwners, personaEntities, personaStatOwners, statRequestOwners,
} from './entityStats';
import { enabledOwnerStats, type OwnerStatTraits } from './statOwners';
import { ownerStatParts } from './statContext';
import { chipValues } from './chipValues/chipValues';
import type { ChipScene } from './chipValues/chipScene';
import { TURN_PASSES, statRequestReady, statSchemaCap, statUpdatesCap } from './turnPipeline/turnPasses';
import { emptyTurnMaterial, type TurnPassRequest } from './turnPipeline/turnPlan';
import { testInput, TEST_PROMPTS } from './turnPipeline/turnTestInputs';
import { planTurn } from './turnPipeline/planTurn';
import { runTurn } from './turnPipeline/turnRunner';
import { computeTurnCommit } from './turnPipeline/computeTurnCommit';

const stat = (over: Partial<PlayerStat> = {}): PlayerStat => ({
  id: 'trust', name: 'Trust', type: 'number', description: '', min: 0, max: 100, value: 20, regen: 0, descriptors: [], ...over,
});

const vigor = stat({ id: 'vigor', name: 'Vigor', value: 50 });
const playerTrust = stat({ id: 'trust', name: 'Trust', value: 10 });
const bram: Entity = { id: 'bram', name: 'Bram' };
const odette: Entity = { id: 'odette', name: 'Odette' };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true };
const values: EntityStatValues = {
  bram: [stat({ value: 30 }), stat({ id: 'grit', name: 'Grit', value: 5, enabled: false })],
  odette: [stat({ value: 40 }), stat({ id: 'stock', name: 'Stock', value: 12 })],
  mira: [stat({ id: 'calm', name: 'Calm' })],
};
const none: PersonaRef = { source: 'none' };
const noTraits = () => [];
const owners = (present: Entity[], persona: PersonaRef = none) => statRequestOwners(present, values, persona, (s) => s, noTraits, (g) => g);
const snapshotFor = (present: Entity[], textPass = false) =>
  createStatRequest([vigor, playerTrust], { textPass, entities: owners(present), inSceneIds: present.map((e) => e.id) });

const statPass = TURN_PASSES.find((pass) => pass.id === 'statUpdates')!;
const shipped = testInput({
  prompts: {
    ...TEST_PROMPTS, statUpdates: defaultStatUpdatesPrompt, statUpdatesUser: defaultStatUpdatesUserPrompt,
    statText: { system: textStatUpdatesPrompt, user: textStatUpdatesUserPrompt },
  },
});
const material = emptyTurnMaterial({ action: 'Haul', effectiveAction: 'Haul', turnId: 'turn', baseCtx: {}, destinations: [] });
/** The playthrough the stat pass reads: `cast` and the played `persona`, each owning its live stats in `held`. */
const sceneOf = (
  stats: PlayerStat[], { cast = [bram, odette], persona, held = values }: { cast?: Entity[]; persona?: Entity; held?: EntityStatValues } = {},
): ChipScene => {
  const ownedStats = enabledOwnerStats(held);
  return {
    overview: '', stats, traits: [], traitGroups: [], ownedStats,
    playedStats: persona ? ownerStatParts([persona], ownedStats) : [],
    persona: persona ? { entity: persona, source: 'world' } : null, playerName: persona?.name ?? null,
    location: null, locations: [], connections: [], entities: cast, presentIds: [], inSceneIds: [],
    lore: [], notes: '', time: null, resolve: (text) => text,
  };
};
/** The stat pass's request, its chips read from `scene` keyed by `snapshot`, as the view builds it. */
const build = (snapshot: StatRequestSnapshot | undefined, scene: ChipScene = sceneOf([vigor, playerTrust])) =>
  statPass.buildRequest(shipped, {
    ...material, statRequest: snapshot, ...(snapshot && { statCtx: chipValues(keyedScene(scene, snapshot)) }),
  });

describe('the stat request with entities', () => {
  it('renders the global stats, then each present owner in the In Scene block under the shipped prompt', () => {
    const { systemPrompt } = build(snapshotFor([bram, odette]));
    expect(systemPrompt).toContain(['## Global Stats', '- **Vigor:** 50/100', '- **Trust:** 10/100', ''].join('\n'));
    expect(systemPrompt).toContain([
      '## In Scene', '- **Bram**', '  - **stats:**', '    - **Trust:** 30/100', '- **Odette**', '  - **stats:**',
      '    - **Trust:** 40/100', '    - **Stock:** 12/100', '',
    ].join('\n'));
    expect(systemPrompt.indexOf('## Global Stats')).toBeLessThan(systemPrompt.indexOf('## In Scene'));
  });

  it('keys the schema by owner, every live stat of each required', () => {
    const { schema } = statRequestSchema(snapshotFor([bram, odette]));
    const required = (node: typeof schema, key: string) => node.type === 'object' && node.properties[key];
    expect(schema.type === 'object' && schema.required).toEqual([GLOBAL_STATS_HEADING, 'Bram', 'Odette']);
    expect(required(schema, 'Bram')).toMatchObject({ required: ['Trust', 'Trust max'] });
    expect(required(schema, 'Odette')).toMatchObject({ required: ['Trust', 'Trust max', 'Stock', 'Stock max'] });
  });

  it('leaves out an absent entity, a switched-off stat, and the played persona', () => {
    const snapshot = snapshotFor([bram]);
    expect(snapshot.targets.map((t) => `${t.ownerKey}/${t.key}`)).toEqual(['Global Stats/Vigor', 'Global Stats/Trust', 'Bram/Trust']);
    expect(build(snapshot).systemPrompt).not.toContain('Odette');
    expect(build(snapshot).systemPrompt).not.toContain('Grit');
    expect(owners([bram, mira], { source: 'world', entityId: 'mira' }).map((o) => o.id)).toEqual(['bram']);
    expect(owners([bram, bram]).map((o) => o.id)).toEqual(['bram']);
  });

  it('leaves out an entity stat its own trait switches off, and ignores an update to it', () => {
    const wary = { id: 'wary', name: 'Wary', statChanges: [], statToggles: [{ statId: 'stock', enabled: false }] };
    const inForce = (ownerId: string) => (ownerId === 'odette' ? [wary] : []);
    const asked = statRequestOwners([odette], values, none, (s) => s, inForce, (g) => g);
    expect(asked.map((o) => o.stats.map((s) => s.id))).toEqual([['trust']]);

    const full = createStatRequest([vigor, playerTrust], { entities: owners([odette]) });
    const reply = JSON.stringify({ You: { Vigor: 0, 'Vigor max': 0, Trust: 0, 'Trust max': 0 }, Odette: { Trust: 0, 'Trust max': 0, Stock: 4, 'Stock max': 0 } });
    const applied = applyEntityStatResponse(values, readStatResponse(reply, full), inForce);
    expect(applied.values.odette[1].value).toBe(12);
  });

  it('numbers an owner key that clashes with either block heading or another owner, and names the entity by it', () => {
    const cast: Entity[] = [
      { id: 'a', name: 'Player Character' }, { id: 'o', name: 'Global Stats' }, { id: 'b', name: '**Bram**' }, { id: 'c', name: 'Bram' },
    ];
    const held = Object.fromEntries(cast.map((e) => [e.id, [stat()]]));
    const snapshot = createStatRequest([vigor], {
      entities: cast.map((e) => ({ id: e.id, name: e.name, stats: held[e.id] })), inSceneIds: cast.map((e) => e.id),
    });
    expect(snapshot.entityKeys).toEqual(['Player Character (2)', 'Global Stats (2)', 'Bram', 'Bram (2)']);
    const { systemPrompt } = build(snapshot, sceneOf([vigor], { cast, held }));
    for (const key of snapshot.entityKeys) expect(systemPrompt).toContain(`- **${key}**\n  - **stats:**\n    - **Trust:** 20/100`);
    // The Stats chip in the stat pass holds the global stats alone.
    expect(snapshot.context('<STATS DESCRIPTION>')).toBe('Vigor');
  });

  it('nests each owner\'s stats under its group headings and leaves the schema as the flat request has it', () => {
    const bonds: StatGroup = { id: 'bonds', name: 'Bonds', aiDescription: 'How {{who}} regards the player.', parentId: null, order: 1 };
    const body: StatGroup = { id: 'body', name: 'Body', parentId: null, order: 0 };
    const grouped: Entity = {
      ...odette, statGroups: [bonds], stats: [stat({ groupId: 'bonds' }), stat({ id: 'stock', name: 'Stock', groupId: null })],
    };
    const resolveWho = (groups: StatGroup[]) => groups.map((g) => ({ ...g, aiDescription: g.aiDescription?.replace('{{who}}', 'Odette') }));
    const playerVigor = { ...vigor, groupId: 'body' };
    const snapshot = createStatRequest([playerVigor, playerTrust], {
      placement: { groups: [body], authored: [playerVigor, playerTrust] },
      entities: statRequestOwners([grouped], values, none, (s) => s, noTraits, resolveWho), inSceneIds: ['odette'],
    });
    const scene = sceneOf([playerVigor, playerTrust], { cast: [{ ...grouped, statGroups: resolveWho([bonds]) }] });
    const { systemPrompt } = build(snapshot, scene);
    expect(systemPrompt).toContain([
      '- **Odette**', '  - **stats:**', '    - **Stock:** 12/100', '    - **Bonds:** How Odette regards the player.',
      '      - **Trust:** 40/100', '',
    ].join('\n'));
    expect(systemPrompt).toContain(['## Global Stats', '- **Trust:** 10/100', '- **Body:**', '  - **Vigor:** 50/100', ''].join('\n'));
    const flat = createStatRequest([vigor, playerTrust], { entities: owners([odette]) });
    expect(statRequestSchema(snapshot)).toEqual(statRequestSchema(flat));
    expect(snapshot.targets.map(({ ownerKey, key, maxKey }) => [ownerKey, key, maxKey]))
      .toEqual(flat.targets.map(({ ownerKey, key, maxKey }) => [ownerKey, key, maxKey]));
  });

  it('sends a hidden group\'s stats under their owner with no group heading', () => {
    const bonds: StatGroup = { id: 'bonds', name: 'Bonds', aiDescription: 'How Odette regards the player.', parentId: null, aiVisible: false };
    const grouped: Entity = { ...odette, statGroups: [bonds], stats: [stat({ groupId: 'bonds' })] };
    const snapshot = createStatRequest([vigor, playerTrust], {
      entities: statRequestOwners([grouped], values, none, (s) => s, noTraits, (groups) => groups), inSceneIds: ['odette'],
    });
    const prompt = build(snapshot, sceneOf([vigor, playerTrust], { cast: [grouped], held: { odette: [stat({ value: 40, groupId: 'bonds' })] } })).systemPrompt;
    expect(prompt).toContain('- **Odette**\n  - **stats:**\n    - **Trust:** 40/100\n');
    expect(prompt).not.toContain('Bonds');
    expect(prompt).not.toContain('How Odette regards the player.');
  });

  it('scales the cap with stats and owners', () => {
    expect(build(snapshotFor([])).maxTokens).toBe(statSchemaCap(2, 1));
    expect(build(snapshotFor([bram, odette])).maxTokens).toBe(statSchemaCap(5, 3));
    expect(statSchemaCap(5, 3)).toBeGreaterThan(statSchemaCap(5, 1));
  });

  it("applies each owner's changes to that owner alone, max before value", () => {
    const snapshot = snapshotFor([bram, odette]);
    const reply = JSON.stringify({
      [GLOBAL_STATS_HEADING]: { Vigor: -5, 'Vigor max': 0, Trust: 0, 'Trust max': 0 },
      Bram: { Trust: 15, 'Trust max': 10 },
      Odette: { Trust: -3, 'Trust max': 0, Stock: 0, 'Stock max': 0 },
    });
    const response = readStatResponse(reply, snapshot);
    const applied = applyEntityStatResponse(values, response, noTraits);
    // At 30/100, +15 only fits under the raised cap if the max moves first: 45/110, not clamped.
    expect(applied.values.bram.map(({ id, value, max }) => [id, value, max])).toEqual([['trust', 45, 110], ['grit', 5, 100]]);
    expect(applied.values.odette[0].value).toBe(37);
    expect(applied.values.mira).toBe(values.mira);
    expect(statResponseChanges(response)).toEqual([{ vigor: -5 }]);
  });

  it('reports every update to an owner the playthrough no longer holds', () => {
    const response = readStatResponse(JSON.stringify({ Bram: { Trust: 2, 'Trust max': 0 } }), snapshotFor([bram]));
    const applied = applyEntityStatResponse({ odette: values.odette }, response, noTraits);
    expect(applied.values).toEqual({ odette: values.odette });
    expect(applied.diagnostics).toEqual([{ name: 'Trust', reason: 'missing' }]);
  });
});

describe('the played persona in the stat request', () => {
  // Mira is played and owns a Trust of her own beside the world's player Trust.
  const playing: PersonaRef = { source: 'world', entityId: 'mira' };
  const miraValues: EntityStatValues = { ...values, mira: [stat({ value: 60 }), stat({ id: 'calm', name: 'Calm', value: 5 })] };
  const personaOwners = (personas: Entity[] = [mira], held: EntityStatValues = miraValues, inForce: OwnerStatTraits = noTraits) =>
    personaStatOwners(personas, held, (s) => s, inForce, (g) => g);
  const joined = (textPass = false) => createStatRequest([vigor, playerTrust], {
    textPass, persona: personaOwners()[0], entities: statRequestOwners([bram, mira], miraValues, playing, (s) => s, noTraits, (g) => g),
    inSceneIds: ['bram'],
  });
  const miraScene = () => sceneOf([vigor, playerTrust], { cast: [bram], persona: mira, held: miraValues });

  it("keys the persona's stats Player Character, the global ones Global Stats, a clash numbered after the global stat", () => {
    const snapshot = joined();
    expect(snapshot.targets.map((t) => [t.ownerId, t.ownerKey, t.key])).toEqual([
      ['mira', PLAYER_STAT_HEADING, 'Trust (2)'], ['mira', PLAYER_STAT_HEADING, 'Calm'],
      [null, GLOBAL_STATS_HEADING, 'Vigor'], [null, GLOBAL_STATS_HEADING, 'Trust'], ['bram', 'Bram', 'Trust'],
    ]);
    expect(snapshot.entityKeys).toEqual(['Bram']);
    const { schema } = statRequestSchema(snapshot);
    expect(schema.type === 'object' && schema.required).toEqual([PLAYER_STAT_HEADING, GLOBAL_STATS_HEADING, 'Bram']);
  });

  it('renders the four blocks of the shipped prompt in order: Global Stats, Global Traits, Player Character, In Scene (Q24)', () => {
    const traits = [{ id: 'wary', name: 'Wary', aiDescription: 'Watches the door.', statChanges: [] }];
    const { systemPrompt } = build(joined(), { ...miraScene(), traits });
    const at = ['## Global Stats\n', '## Global Traits\n', '## Player Character\n- **Mira**', '## In Scene\n- **Bram**']
      .map((block) => systemPrompt.indexOf(block));
    expect(at.every((i) => i >= 0), systemPrompt).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(systemPrompt).toContain('    - **Trust (2):** 60/100\n    - **Calm:** 5/100\n');
    expect(systemPrompt).toContain('## Global Stats\n- **Vigor:** 50/100\n- **Trust:** 10/100\n');
  });

  it('renders no Player Character block and asks no Player Character object of a persona that owns no stats', () => {
    const snapshot = createStatRequest([vigor, playerTrust], {
      persona: personaOwners([mira], { mira: [] })[0], entities: owners([bram]), inSceneIds: ['bram'],
    });
    const { schema } = statRequestSchema(snapshot);
    expect(schema.type === 'object' && schema.required).toEqual([GLOBAL_STATS_HEADING, 'Bram']);
    const { systemPrompt } = build(snapshot, sceneOf([vigor, playerTrust], { cast: [bram], persona: mira, held: { bram: values.bram } }));
    expect(systemPrompt).not.toContain('## Player Character');
    expect(systemPrompt).toContain('## In Scene\n- **Bram**');
    const response = readStatResponse(JSON.stringify({ [GLOBAL_STATS_HEADING]: { Vigor: 3, 'Vigor max': 0 }, Bram: { Trust: 0, 'Trust max': 0 } }), snapshot);
    expect(response).toMatchObject({ updates: [{ ownerId: null, id: 'vigor', value: 3 }], diagnostics: [] });
  });

  it('asks one object per owner kind: Player Character, Global Stats and each present entity, every key unique', () => {
    const snapshot = createStatRequest([vigor, playerTrust], {
      persona: personaOwners()[0], entities: owners([bram, odette]), inSceneIds: ['bram', 'odette'],
    });
    const { schema } = statRequestSchema(snapshot);
    expect(schema.type === 'object' && schema.required).toEqual([PLAYER_STAT_HEADING, GLOBAL_STATS_HEADING, 'Bram', 'Odette']);
    for (const owner of new Set(snapshot.targets.map((t) => t.ownerKey))) {
      const keys = snapshot.targets.filter((t) => t.ownerKey === owner).flatMap((t) => [t.key, t.maxKey]);
      expect(new Set(keys).size, owner).toBe(keys.length);
    }
  });

  it('sends a present entity with no stats to a custom prompt with no filter, never to the shipped prompt', () => {
    const rook: Entity = { id: 'rook', name: 'Rook' };
    const snapshot = createStatRequest([vigor], { entities: owners([bram, rook]), inSceneIds: ['bram', 'rook'] });
    const scene = sceneOf([vigor], { cast: [bram, rook] });
    expect(build(snapshot, scene).systemPrompt).not.toContain('Rook');
    const custom = testInput({ prompts: { ...TEST_PROMPTS, statUpdates: 'Cast:\n<ENTITIES|inscene.name>', statUpdatesUser: '<NARRATION>' } });
    const request = statPass.buildRequest(custom, { ...material, statRequest: snapshot, statCtx: chipValues(keyedScene(scene, snapshot)) });
    expect(request.systemPrompt).toBe('Cast:\nBram, Rook');
  });

  it('lands each change on its own stat: the world Trust, then the persona Trust', () => {
    const snapshot = joined();
    const reply = JSON.stringify({
      [GLOBAL_STATS_HEADING]: { Vigor: 0, 'Vigor max': 0, Trust: 2, 'Trust max': 0 },
      [PLAYER_STAT_HEADING]: { 'Trust (2)': -7, 'Trust (2) max': 0, Calm: 0, 'Calm max': 0 },
      Bram: { Trust: 0, 'Trust max': 0 },
    });
    const response = readStatResponse(reply, snapshot);
    expect(response.updates).toEqual([
      { ownerId: null, id: 'trust', name: 'Trust', value: 2, max: 0 },
      { ownerId: 'mira', id: 'trust', name: 'Trust', value: -7, max: 0 },
    ]);
    expect(applyEntityStatResponse(miraValues, response, noTraits).values.mira[0].value).toBe(53);
    expect(statResponseChanges(response)).toEqual([{ trust: 2 }]);
  });

  it("covers the persona's stats on the text pass, and skips only the entities", () => {
    const snapshot = joined(true);
    const { systemPrompt } = build(snapshot, miraScene());
    expect(systemPrompt).toContain('- **Trust (2):** 60/100');
    expect(systemPrompt.indexOf('## Global Stats')).toBeLessThan(systemPrompt.indexOf('## Player Character'));
    expect(systemPrompt).not.toContain('Bram');
    const response = readStatResponse('Trust (2): -3', snapshot);
    expect(response.updates).toEqual([{ ownerId: 'mira', id: 'trust', name: 'Trust', value: -3, max: 0 }]);
    expect(response.diagnostics).toEqual([{ name: '', reason: 'textPass' }, { name: 'Bram', reason: 'skipped' }]);
  });

  it('runs for a player whose only live stats are the persona\'s', () => {
    const snapshot = createStatRequest([], { textPass: true, persona: personaOwners()[0] });
    expect(statRequestReady(snapshot)).toBe(true);
    expect(build(snapshot, sceneOf([], { persona: mira, held: miraValues })).systemPrompt)
      .toMatch(/## Player Character\n[\s\S]*- \*\*Trust:\*\* 60\/100[\s\S]*- \*\*Calm:\*\* 5\/100/);
  });

  it("lays the persona's stats out by its own groups in the text pass's Player Character block, and leaves them out of the Stats chip", () => {
    const mood: StatGroup = { id: 'mood', name: 'Mood', parentId: null, order: 0 };
    const grouped: Entity = { ...mira, statGroups: [mood], stats: [stat({ id: 'calm', name: 'Calm', groupId: 'mood' })] };
    const held = { mira: [stat({ id: 'calm', name: 'Calm', value: 5, groupId: 'mood' })] };
    const snapshot = createStatRequest([vigor], { textPass: true, persona: personaOwners([grouped], held)[0] });
    expect(snapshot.context('<STATS DESCRIPTION|numbers.markdown>')).toBe('- **Vigor:** 50/100');
    const { systemPrompt } = build(snapshot, sceneOf([vigor], { persona: grouped, held }));
    expect(systemPrompt).toContain('## Player Character');
    expect(systemPrompt).toMatch(/- \*\*Mood:\*\*\n\s+- \*\*Calm:\*\* 5\/100/);
    expect(systemPrompt).toContain('## Global Stats\n- **Vigor:** 50/100\n');
  });

  it("leaves out a persona stat its own trait switches off, and a persona that holds no stats", () => {
    const calmOff = { id: 'still', name: 'Still', statChanges: [], statToggles: [{ statId: 'calm', enabled: false }] };
    expect(personaOwners([mira], miraValues, () => [calmOff]).map((o) => o.stats.map((s) => s.id))).toEqual([['trust']]);
    expect(personaOwners([{ id: 'nobody', name: 'Nobody' }, mira, mira]).map((o) => o.id)).toEqual(['mira']);
  });

  it('joins the played entity from any source, and the Custom Persona entity whose traits are the player\'s', () => {
    const custom: Entity = { id: 'custom', name: 'You', customPersona: true };
    const shade: Entity = { id: 'shade', name: 'Shade', persona: true };
    const world = [bram, mira, custom];
    const ids = (played: Entity | undefined, ref: PersonaRef) => personaEntities(played, world, ref).map((e) => e.id);
    expect(ids(mira, playing)).toEqual(['mira']);
    expect(ids(shade, { source: 'library', entityId: 'shade' })).toEqual(['shade', 'custom']);
    expect(ids({ ...custom, name: 'Ash' }, none)).toEqual(['custom']);
    expect(personaEntities({ ...custom, name: 'Ash' }, world, none)[0].name).toBe('Ash');
    expect(ids(undefined, none)).toEqual(['custom']);
  });

  it('joins a library persona and the Custom Persona entity, each change on its own owner', () => {
    const shade: Entity = { id: 'shade', name: 'Shade', persona: true };
    const custom: Entity = { id: 'custom', name: 'You', customPersona: true };
    const held: EntityStatValues = { shade: [stat({ value: 30 })], custom: [stat({ value: 70 })] };
    const [played, other] = personaOwners([shade, custom], held);
    const snapshot = createStatRequest([vigor], { persona: played, played: [other] });
    // Every played entity's stats sit under Player Character, a clash numbered (Q11).
    expect(snapshot.targets.map((t) => [t.ownerId, t.ownerKey, t.key])).toEqual([
      ['shade', PLAYER_STAT_HEADING, 'Trust'], ['custom', PLAYER_STAT_HEADING, 'Trust (2)'], [null, GLOBAL_STATS_HEADING, 'Vigor'],
    ]);
    expect(snapshot.context('<STATS DESCRIPTION|numbers.markdown>')).toBe('- **Vigor:** 50/100');
    const reply = {
      [PLAYER_STAT_HEADING]: { Trust: 4, 'Trust max': 0, 'Trust (2)': -4, 'Trust (2) max': 0 },
      [GLOBAL_STATS_HEADING]: { Vigor: 0, 'Vigor max': 0 },
    };
    const applied = applyEntityStatResponse(held, readStatResponse(JSON.stringify(reply), snapshot), noTraits);
    expect([applied.values.shade[0].value, applied.values.custom[0].value]).toEqual([34, 66]);
  });
});

describe('the text-pass fallback', () => {
  it("sends the player's section alone and skips each present entity with a diagnostic", () => {
    const snapshot = snapshotFor([bram, odette], true);
    const request = build(snapshot);
    expect(request.responseSchema).toBeUndefined();
    expect(request.systemPrompt).not.toContain('Bram');
    expect(request.maxTokens).toBe(statUpdatesCap(2));
    const response = readStatResponse('Trust: +4', snapshot);
    expect(response.updates).toEqual([{ ownerId: null, id: 'trust', name: 'Trust', value: 4, max: 0 }]);
    expect(response.diagnostics).toEqual([
      { name: '', reason: 'textPass' }, { name: 'Bram', reason: 'skipped' }, { name: 'Odette', reason: 'skipped' },
    ]);
  });

  it('asks nothing of a player with no stats: no text pass, and no fallback for a refused schema', () => {
    const textPass = createStatRequest([], { textPass: true, entities: owners([bram]) });
    expect(statRequestReady(textPass)).toBe(false);
    const schema = createStatRequest([], { entities: owners([bram]) });
    expect(statRequestReady(schema)).toBe(true);
    expect(build(schema).textFallback).toBeUndefined();
    expect(statRequestReady(createStatRequest([]))).toBe(false);
  });

  it('builds the retry after a mid-turn refusal from the player alone', () => {
    const request = build(snapshotFor([bram]));
    expect(request.systemPrompt).toContain('## In Scene\n- **Bram**');
    expect(request.textFallback?.systemPrompt).not.toContain('Bram');
    expect(request.textFallback?.maxTokens).toBe(statUpdatesCap(2));
  });
});

describe('the stat pass over a turn', () => {
  const run = async (playerStats: PlayerStat[], participants: Entity[]) => {
    const input = testInput({}, { thinkingMode: 'off', concurrentTurnRequests: false });
    const plan = planTurn(input);
    const sent: TurnPassRequest[] = [];
    let confirmed: Entity[] = [];
    const result = await runTurn({
      plan, material, signal: new AbortController().signal,
      request: async (request) => {
        sent.push(request);
        if (request.type === 'narration') return 'Bram hauls the line beside you.';
        if (request.type !== 'statUpdates' || !request.statRequest) return '';
        return JSON.stringify({ [GLOBAL_STATS_HEADING]: {}, Bram: { Trust: 2, 'Trust max': 0 } });
      },
      // The view's derivation step: the narration confirms who is present, and the stat request follows them.
      advance: (event) => {
        if (event.at === 'pass' && event.outcomes[0].id === 'narration') {
          confirmed = participants;
          return { narration: event.outcomes[0].raw };
        }
        if (event.at === 'stage' && event.stage === 'postNarration') {
          return { statRequest: createStatRequest(playerStats, { entities: owners(confirmed) }) };
        }
      },
    });
    const commit = computeTurnCommit({ result, plan, context: {
      participants: [], knownDiscoveredNames: [], notes: '', reasoning: { text: '', ms: 0 }, gameTime: 0,
    } });
    return { stat: sent.find((r) => r.type === 'statUpdates'), commit };
  };

  it('sends the present entities the narration confirmed, and reads their changes back by owner', async () => {
    const { stat: request, commit } = await run([vigor], [bram]);
    expect(request?.statRequest?.entityKeys).toEqual(['Bram']);
    expect(commit?.statResponse?.updates).toEqual([{ ownerId: 'bram', id: 'trust', name: 'Trust', value: 2, max: 0 }]);
    expect(commit?.turn.stat_changes).toEqual([]);
  });

  it('runs for a player with no stats when a present entity has one, and sends nothing when none does', async () => {
    expect((await run([], [bram])).stat?.statRequest?.targets.map((t) => t.ownerKey)).toEqual(['Bram']);
    expect((await run([], [])).stat).toBeUndefined();
  });
});

describe('entity stats after the request', () => {
  it("hands each owner's asks to its code, over the values from before them", () => {
    const after = { ...values, bram: [{ ...values.bram[0], value: 45 }, values.bram[1]] };
    const asks = { bram: [{ id: 'trust', value: 15, max: 0 }] };
    const [turn] = entityCodeTurns(entityStatOwners(after, [bram], none, noTraits), 0, (_, s) => s, { previous: values, asks });
    expect(turn).toMatchObject({ id: 'bram', asks: asks.bram, previous: values.bram });
    expect(turn.stats[0].value).toBe(45);
  });

  it('records what a turn moved each entity stat, by owner and stat id', () => {
    const after = { ...values, bram: [{ ...values.bram[0], value: 33 }, values.bram[1]], rook: [stat()] };
    expect(entityStatDeltas(after, values)).toEqual({ bram: { trust: 3 } });
    expect(entityStatDeltas(values, values)).toEqual({});
  });
});
