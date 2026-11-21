import { describe, expect, it } from 'vitest';
import { idLog, openingFold, type OpeningFoldWorld } from './openingState';
import { entryGateInput } from './entryDraft';
import { gateOf, gateStates } from './traitGates';
import { libraryGateInput } from './libraryGateInput';
import type { Entity, Opening, Trait, WorldOverview } from '@/types';

const rainOnly: Trait = { id: 'rainy', name: 'Rainy', statChanges: [], playerToggle: true, requires: [{ all: [{ kind: 'weather', kinds: ['rain'] }] }] };
const nightOnly: Trait = { id: 'nocturnal', name: 'Nocturnal', statChanges: [], playerToggle: true, requires: [{ all: [{ kind: 'time', dayparts: ['night'] }] }] };

const overview = (extra: Partial<WorldOverview> = {}): WorldOverview =>
  ({ weather: { on: true, allowed: ['rain', 'snow'] }, ...extra }) as WorldOverview;
const worldOf = (worldOverview: WorldOverview): OpeningFoldWorld => ({ traits: [rainOnly, nightOnly], worldOverview });
const row = (extra: Partial<Opening> = {}): Opening => ({ id: 'o', text: 'x', kind: 'action', ...extra });
const picks = { traits: ['rainy', 'nocturnal'], owned: {} };
// The gate the first settle builds: which of the picked traits hold at the start.
const heldIds = (fold: ReturnType<typeof openingFold>) =>
  ['rainy', 'nocturnal'].filter((id) => gateOf(gateStates(fold.gate), null, id)?.unlocked);

describe('the first settle reads the start', () => {
  it('holds a Rain trait and a night trait under an Opening with Weather Rain and Time night', () => {
    const fold = openingFold(worldOf(overview()), picks, undefined, undefined, row({ weather: 'rain', time: 'night' }));
    expect(heldIds(fold)).toEqual(['rainy', 'nocturnal']);
    expect(fold.state.weather?.current).toBe('rain');
  });

  it('reads Default Weather and Default Time when the Opening sets neither', () => {
    const world = worldOf(overview({ weather: { on: true, allowed: ['rain'], defaultWeather: 'rain' }, defaultTime: 'night' }));
    expect(heldIds(openingFold(world, picks, undefined, undefined, row()))).toEqual(['rainy', 'nocturnal']);
    expect(heldIds(openingFold(world, picks))).toEqual(['rainy', 'nocturnal']);
  });

  it('reads Clear and the shipped start hour with nothing authored', () => {
    const fold = openingFold(worldOf(overview()), picks, undefined, undefined, row());
    expect(heldIds(fold)).toEqual([]);
    expect(fold.state.weather?.current).toBe('clear');
  });

  it('settles again from another Opening on a redraw', () => {
    const world = worldOf(overview());
    expect(heldIds(openingFold(world, picks, undefined, undefined, row({ weather: 'rain' })))).toEqual(['rainy']);
    expect(heldIds(openingFold(world, picks, undefined, undefined, row({ weather: 'snow' })))).toEqual([]);
  });
});

describe('Enter World and the library entity editor read the defaults', () => {
  const defaults = overview({ weather: { on: true, allowed: ['rain'], defaultWeather: 'rain' }, defaultTime: 'night' });
  const entryWorld = { traits: [rainOnly, nightOnly], traitGroups: [], entities: [], library: [] };
  const unlockedIn = (world: typeof entryWorld & { overview?: WorldOverview }, id: string) =>
    gateOf(gateStates(entryGateInput(world, { traitIds: [], ownedTraitIds: {}, persona: { source: 'none' } })), null, id)!.unlocked;

  it('unlocks the Rain and night traits at the world defaults in Enter World', () => {
    expect(unlockedIn({ ...entryWorld, overview: defaults }, 'rainy')).toBe(true);
    expect(unlockedIn({ ...entryWorld, overview: defaults }, 'nocturnal')).toBe(true);
  });

  it('reads Clear and the shipped hour in Enter World with neither set', () => {
    expect(unlockedIn({ ...entryWorld, overview: overview() }, 'rainy')).toBe(false);
    expect(unlockedIn(entryWorld, 'nocturnal')).toBe(false);
  });

  it('unlocks them at the world defaults in the library entity editor', () => {
    const entity = { id: 'e', name: 'E', description: '', locations: [], traits: [] } as Entity;
    const world = { traits: [rainOnly, nightOnly], traitGroups: [], entities: [], placeholders: [], weather: defaults.weather, defaultTime: defaults.defaultTime };
    const states = gateStates(libraryGateInput(entity, world));
    expect(gateOf(states, null, 'rainy')!.unlocked).toBe(true);
    expect(gateOf(states, null, 'nocturnal')!.unlocked).toBe(true);
    const bare = gateStates(libraryGateInput(entity, { ...world, weather: undefined, defaultTime: undefined }));
    expect(gateOf(bare, null, 'rainy')!.unlocked).toBe(false);
    expect(gateOf(bare, null, 'nocturnal')!.unlocked).toBe(false);
  });
});

describe('the second settle draws nothing again', () => {
  const lamp = { id: 'lamp', name: 'Lamp', statEffects: [], traitEffects: [], equipRequires: [] };
  const world: OpeningFoldWorld = {
    ...worldOf(overview()), items: [lamp],
    placements: [
      { id: 'p1', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } },
      { id: 'p2', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lamp' } },
    ],
  };
  const counter = () => { let n = 0; return () => `id-${n++}`; };

  it('mints the same Item Instance ids and leaves the stats alone, while the weather Conditions change', () => {
    const ids = idLog(counter());
    const first = openingFold(world, picks, undefined, ids.newId);
    const second = openingFold(world, picks, undefined, ids.replay(), row({ weather: 'rain', time: 'night' }));
    expect(second.state.itemInstances?.map((i) => i.id)).toEqual(first.state.itemInstances?.map((i) => i.id));
    expect(second.entityStats).toEqual(first.entityStats);
    expect(second.traitState.stats).toEqual(first.traitState.stats);
    expect(heldIds(first)).toEqual([]);
    expect(heldIds(second)).toEqual(['rainy', 'nocturnal']);
  });

  it('would mint new ids if the second settle drew again', () => {
    const mint = counter();
    const first = openingFold(world, picks, undefined, mint);
    const again = openingFold(world, picks, undefined, mint, row({ weather: 'rain' }));
    expect(again.state.itemInstances?.map((i) => i.id)).not.toEqual(first.state.itemInstances?.map((i) => i.id));
  });
});
