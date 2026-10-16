import { describe, it, expect } from 'vitest';
import { chipValues } from './chipValues';
import type { ChipScene } from './chipScene';
import { defaultStatUpdatesPrompt } from '@/components/game/GamePrompts';
import { renderPromptTemplate } from '../promptTemplate';
import { createStatRequest, keyedScene } from '../statRequest';
import { ownerStatParts, statPlacementOf } from '../statContext';
import type { ResolvedPersona } from '../persona';
import type { Entity, GameLocation, PlayerStat } from '@/types';

const stat = (id: string, name: string, value: number): PlayerStat => ({
  id, name, type: 'number', description: `${name} meaning.`, min: 0, max: 100, value, regen: 0, descriptors: [],
});

// The town: the Hall holds the Cellar; the Market sits beside the Hall, under the town.
const town: GameLocation = { id: 'town', name: 'Town', aiDescription: 'A river town.' };
const hall: GameLocation = { id: 'hall', name: 'Hall', parentId: 'town', aiDescription: 'A long hall.' };
const cellar: GameLocation = { id: 'cellar', name: 'Cellar', parentId: 'hall', aiDescription: 'A cold cellar.' };
const market: GameLocation = { id: 'market', name: 'Market', parentId: 'town', aiDescription: 'Stalls.' };

const health = stat('health', 'Health', 62);
// The traveler's own Health clashes with the world's, so the request keys it "Health (2)".
const travelerHealth = stat('traveler-health', 'Health', 10);
// Each of these owners holds two stats of one name, so the request keys the second "Mood (2)", which reads "Warm" up to 80.
const moods = (owner: string) => [
  stat(`${owner}-mood-a`, 'Mood', 30),
  { ...stat(`${owner}-mood-b`, 'Mood', 70), descriptors: [{ id: 'warm', threshold: 80, description: 'Warm' }] },
];

const entity = (id: string, name: string, locations: string[]): Entity => ({ id, name, locations, aiDescription: `${name} is here.` });
const traveler = entity('traveler', 'Traveler', ['hall']);
const guard = entity('guard', 'Guard', ['hall']);
const cook = entity('cook', 'Cook', ['cellar']);
const baker = entity('baker', 'Baker', ['market']);
const persona: ResolvedPersona = { entity: traveler, source: 'library' };

const ownedStats = {
  traveler: [travelerHealth],
  guard: moods('guard'),
  cook: moods('cook'),
  baker: moods('baker'),
};

const scene = (over: Partial<ChipScene> = {}): ChipScene => ({
  overview: 'A river town.',
  stats: [health],
  traits: [],
  traitGroups: [],
  ownedStats,
  playedStats: ownerStatParts([traveler], ownedStats),
  persona,
  playerName: 'Traveler',
  location: hall,
  locations: [town, hall, cellar, market],
  connections: [],
  entities: [traveler, guard, cook, baker],
  presentIds: ['traveler', 'guard'],
  inSceneIds: ['traveler', 'guard'],
  lore: [],
  notes: '',
  time: null,
  resolve: (text) => text,
  ...over,
});

const ownerOf = (owner: Entity) => ({ id: owner.id, name: owner.name, stats: ownedStats[owner.id as keyof typeof ownedStats], placement: statPlacementOf(owner) });

const request = createStatRequest([health], {
  persona: ownerOf(traveler),
  entities: [ownerOf(guard), ownerOf(cook), ownerOf(baker)],
  inSceneIds: ['traveler', 'guard'],
});

describe('the keyed scene for the stat pass', () => {
  const raw = chipValues(scene());
  const keyed = chipValues(keyedScene(scene(), request));

  it('names a clashing stat in an In Scene cast entry by its request key, while the narration keeps its raw name', () => {
    expect(keyed('<ENTITIES|inscene>')).toContain('Health (2): 10/100');
    expect(raw('<ENTITIES|inscene>')).toContain('Health: 10/100');
    expect(raw('<ENTITIES|inscene>')).not.toContain('Health (2)');
  });

  it("names a clashing persona stat by its request key in the Persona chip", () => {
    expect(keyed('<PERSONA|markdown>')).toContain('**Health (2):** 10/100');
    expect(keyed('<PERSONA|markdown>')).not.toMatch(/\*\*Health:\*\*/);
  });

  it('keys a stat that clashes inside one owner, in every Entities scope', () => {
    for (const token of ['<ENTITIES|inscene>', '<ENTITIES>', '<ENTITIES|sublocations.stats>', '<ENTITIES|reachable.stats>']) {
      expect(keyed(token), token).toContain('Mood (2): 70/100');
      expect(raw(token), token).not.toContain('Mood (2)');
    }
  });

  it('keys the Persona chip over a played entity that is not the persona, and the Stats chip over the global stats alone', () => {
    const custom = entity('custom', 'The Creature', []);
    const customHealth = stat('custom-health', 'Health', 40);
    const both = scene({
      ownedStats: { ...ownedStats, custom: [customHealth] },
      playedStats: ownerStatParts([traveler, custom], { ...ownedStats, custom: [customHealth] }),
    });
    const withCustom = createStatRequest([health], {
      persona: ownerOf(traveler), played: [{ id: 'custom', name: 'The Creature', stats: [customHealth] }],
    });
    const keyed = chipValues(keyedScene(both, withCustom));
    expect(keyed('<STATS DESCRIPTION|numbers>')).toBe('Health: 62/100');
    expect(keyed('<PERSONA|withstats.summary>')).toContain('Health (3): 40/100');
  });

  it('leaves a stat the request does not hold under its raw name, and the narration scene untouched', () => {
    const input = scene();
    const out = keyedScene(input, createStatRequest([health], { entities: [ownerOf(guard)], inSceneIds: input.inSceneIds }));
    expect(chipValues(out)('<ENTITIES|reachable.stats>')).toContain('Mood: 70/100');
    expect(chipValues(out)('<ENTITIES|inscene>')).toContain('Health: 10/100');
    expect(input.ownedStats?.guard.map((s) => s.name)).toEqual(['Mood', 'Mood']);
  });

  it('is the scene itself when the request holds no targets', () => {
    const input = scene();
    expect(keyedScene(input, createStatRequest([]))).toBe(input);
  });

  it('holds In Scene to the request\'s present entities, the stat-less ones included, whoever the scene had', () => {
    const rook = entity('rook', 'Rook', ['hall']);
    const input = scene({ entities: [traveler, guard, cook, baker, rook], inSceneIds: ['cook'], inSceneNames: ['a stranger'] });
    const out = chipValues(keyedScene(input, createStatRequest([health], {
      entities: [ownerOf(guard)], inSceneIds: ['guard', 'rook'],
    })));
    expect(out('<ENTITIES|inscene.name>')).toBe('Guard, Rook');
    expect(out('<ENTITIES|inscene.withstats.name>')).toBe('Guard');
  });

  it('renders the default stat prompt from the keyed scene: the persona and each present owner by request key', () => {
    // Read from the scene alone: the snapshot's own Stats value would hide a drift in the scene's.
    const render = (values: ReturnType<typeof chipValues>) => renderPromptTemplate(defaultStatUpdatesPrompt, values);
    expect(render(keyed)).toContain('## Player Character\n- **Traveler**');
    expect(render(keyed)).toContain('**Health (2):** 10/100');
    expect(render(keyed)).toMatch(/## In Scene\n[^#]*- \*\*Guard\*\*/);
    expect(render(keyed)).toContain('**Mood (2):** 70/100');
    expect(render(raw)).not.toContain('Mood (2)');
  });

  it('renders a keyed In Scene stat in the default stat prompt with its range, descriptor and description', () => {
    const inScene = renderPromptTemplate(defaultStatUpdatesPrompt, keyed).split('## In Scene\n')[1].split('\n## ')[0];
    expect(inScene).toContain('**Mood (2):** 70/100 (Warm) — Mood meaning.');
  });
});
