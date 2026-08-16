import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { GameDataProvider, useGameData } from './GameDataContext';
import { PlaceholderSessionProvider, usePlaceholderSession } from './PlaceholderSessionContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { PlaceholderRolls, World } from '@/types';

// GameDataProvider enumerates the installed worlds on mount; jsdom has no IndexedDB, and the world under
// test is handed straight to `loadWorldData` rather than read from storage.
vi.mock('@/services/WorldStorageService', () => {
  const stub = { initialize: () => Promise.resolve(), getAllWorldMetadata: () => Promise.resolve([]) };
  return { WorldStorageService: stub, default: stub };
});

const TOWN = { id: 'ph-town', name: 'Town', values: ['Sedge', 'Marrow'] };
const HAIR = { id: 'ph-hair', name: 'Hair', values: ['red', 'black'] };
const tok = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });

/** A world whose *names* carry the chips — the case the session exists for. */
const world = (placeholders = [TOWN, HAIR]) => ({
  id: 'w1',
  version: '2.9.2',
  worldOverview: { name: 'Test', description: '', author: '', systemPrompt: '', use3DModel: false, tags: [] },
  placeholders,
  stats: [],
  locations: [{ id: 'l1', name: `${tok(TOWN.id, 'p1')} Square`, isStarting: true }],
  entities: [{ id: 'e1', name: `${tok(HAIR.id, 'p2')} stranger` }],
  entityGroups: [],
  traits: [],
  traitGroups: [],
  statUpdates: [],
  dictionaries: [],
} as unknown as World);

interface Handle {
  session: ReturnType<typeof usePlaceholderSession>;
  loadWorldData: ReturnType<typeof useGameData>['loadWorldData'];
}

function mount() {
  let handle: Handle | null = null;
  const Probe = () => {
    handle = { session: usePlaceholderSession(), loadWorldData: useGameData().loadWorldData };
    return null;
  };
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <Probe />
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  const live = () => {
    if (!handle) throw new Error('probe never rendered');
    return handle;
  };
  return {
    live,
    loadWorld: (w: World = world()) => act(() => { live().loadWorldData(w); }),
    begin: (rolls?: PlaceholderRolls) => act(() => { live().session.beginSession(rolls); }),
    setRolls: (rolls: PlaceholderRolls) => act(() => { live().session.setRolls(rolls); }),
    end: () => act(() => { live().session.endSession(); }),
    rolls: () => live().session.rolls,
  };
}

describe('PlaceholderSessionProvider', () => {
  it('rolls nothing until a session opens, so the library and world details stay unrolled', () => {
    const h = mount();
    h.loadWorld();
    expect(h.rolls()).toEqual({});
  });

  it('rolls every Wildcard in a name once the session opens', () => {
    const h = mount();
    h.loadWorld();
    h.begin();
    // Both chips live in names, which is what the old game-start priming could not reach in time.
    expect(TOWN.values).toContain(h.rolls().world?.[TOWN.id]);
    expect(HAIR.values).toContain(h.rolls().world?.[HAIR.id]);
  });

  it('rolls a Wildcard that appears only in the Introduction readme', () => {
    // The Introduction is shown at the top of the enter-world flow, so a placement it alone carries has to
    // be primed with the rest — resolving from an unprimed roll draws a new value on every render.
    const w = world();
    (w.worldOverview as { introReadme?: string }).introReadme = `Welcome to ${encodePlaceholderToken({ id: TOWN.id, mode: 'unique', placementId: 'intro-1' })}.`;
    const h = mount();
    h.loadWorld(w);
    h.begin();
    expect(TOWN.values).toContain(h.rolls().unique?.['intro-1']);
  });

  it('keeps its rolls when the session is reopened on the way into the game view', () => {
    const h = mount();
    h.loadWorld();
    h.begin();
    const drawn = h.rolls().world?.[TOWN.id];
    // The enter-world flow opens the session; the handoff to the game view opens it again. If that second
    // call re-rolled, the name on the picker would not be the name in the game.
    h.begin();
    expect(h.rolls().world?.[TOWN.id]).toBe(drawn);
  });

  it('never re-rolls a resumed save, and tops up a placement the save predates', () => {
    const h = mount();
    h.loadWorld();
    // A save written before Hair was authored: it froze Town and knows nothing about Hair.
    h.begin({ world: { [TOWN.id]: 'Marrow' }, unique: {} });
    expect(h.rolls().world?.[TOWN.id]).toBe('Marrow');
    expect(HAIR.values).toContain(h.rolls().world?.[HAIR.id]);
  });

  it('tops up a save that lands after priming has already run', () => {
    const h = mount();
    h.loadWorld();
    // The cold-load path: the session opens empty because App has only the save id, and the save's own
    // rolls arrive from GameplayContext's restore a beat later — after this first priming pass.
    h.begin();
    h.setRolls({ world: { [TOWN.id]: 'Marrow' }, unique: {} });

    // The restored value is authoritative...
    expect(h.rolls().world?.[TOWN.id]).toBe('Marrow');
    // ...and the placement the save predates still gets one, rather than resolving to nothing all game.
    expect(HAIR.values).toContain(h.rolls().world?.[HAIR.id]);
  });

  it('drops its rolls when the session ends, so the next entry draws again', () => {
    const h = mount();
    h.loadWorld();
    h.begin();
    h.end();
    expect(h.rolls()).toEqual({});
  });

  it('does not carry a roll from one world into the next', () => {
    const h = mount();
    h.loadWorld();
    h.begin();
    h.end();
    h.loadWorld(world([{ id: 'ph-other', name: 'Other', values: ['a', 'b'] }]));
    h.begin();
    expect(h.rolls().world?.[TOWN.id]).toBeUndefined();
  });
});
