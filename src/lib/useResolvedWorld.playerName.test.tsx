// Real in-memory storage for saves and the entity library; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from '@/contexts/GameplayContext';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { PlaceholderSessionProvider } from '@/contexts/PlaceholderSessionContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { drawNewGameOpening } from '@/lib/newGameOpening';
import { worldFixture } from '@/test/gamePanels';
import type { Entity } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

interface Live {
  gameplay: ReturnType<typeof useGameplay>;
  gameData: ReturnType<typeof useGameData>;
  world: ReturnType<typeof useResolvedWorld>;
}

const Expose = ({ expose }: { expose: (l: Live) => void }) => {
  expose({ gameplay: useGameplay(), gameData: useGameData(), world: useResolvedWorld() });
  return null;
};

const mount = () => {
  let live: Live | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(l) => { live = l; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!live) throw new Error('contexts not available (did the render throw?)');
    return live as Live;
  };
};

// The greeting holds the marker as an import before the Player Name chip stored it.
const greeting = '{{user}} steps off the boat. Vos takes {{user}}’s bag.';
const mira: Entity = { id: 'w-mira', name: 'Mira', persona: true, locations: ['dock'] };
const vos: Entity = {
  id: 'w-vos', name: 'Captain Vos', locations: ['dock'],
  openings: [{ id: 'o-greet', text: greeting, kind: 'narration' }],
};
const wren: Entity = { id: 'l-wren', name: 'Wren', persona: true };

const loadWorld = async (live: () => Live) => {
  await act(async () => { live().gameData.loadWorldData(worldFixture({ entities: [mira, vos] })); });
};

// A source scan, since the game view is too large to mount: its three opening sites reach the helper below.
describe('the game view renders every opening through resolveOpening', () => {
  const viewer = readFileSync(join(process.cwd(), 'src/views/GameViewer.tsx'), 'utf8');

  it('passes the first draw its persona, and renders no opening any other way', () => {
    expect(viewer).toMatch(
      /resolveOpening\(drawn\.opening\.text, \{\s*extraPins: openingPins, persona: drawnPersona, rolls: personaRolls,\s*\}\)/,
    );
    expect(viewer).toMatch(/resolveOpening\(redraw\.opening\.text\)/);
    expect(viewer).toMatch(/openingCue: resolveOpening\(openingCue\(\)\.text\)/);
    expect(viewer).not.toMatch(/renderBuiltins|resolve(PH|With|For)\([^)]*(opening\.text|openingCue\(\))/);
  });
});

describe('the Player Name chip in play', () => {
  it('names the persona on page one at the first draw, before the persona is in state', async () => {
    const live = mount();
    await loadWorld(live);
    const { persona, draw } = drawNewGameOpening({
      pick: { ref: { source: 'library', entityId: wren.id }, libraryEntity: wren },
      worldEntities: live().gameData.entities,
      overview: live().gameData.worldOverview,
      startingLocationId: 'dock',
      picked: [],
      random: () => 0,
    });
    expect(live().gameplay.personaRef).toBeUndefined();
    expect(live().world.resolveOpening(draw.opening.text, { persona }))
      .toBe('Wren steps off the boat. Vos takes Wren’s bag.');
  });

  it('names the persona in state when page one is drawn again', async () => {
    const live = mount();
    await loadWorld(live);
    await act(async () => { live().gameplay.setPersonaRef({ source: 'world', entityId: mira.id }); });
    expect(live().world.resolveOpening(greeting)).toBe('Mira steps off the boat. Vos takes Mira’s bag.');
  });

  it('keeps "you" on page one with no persona', async () => {
    const live = mount();
    await loadWorld(live);
    await act(async () => { live().gameplay.setPersonaRef({ source: 'none' }); });
    expect(live().world.resolveOpening(greeting)).toBe('You steps off the boat. Vos takes your bag.');
  });

  it('names the persona in reference text, and reads "the player" with none', async () => {
    const live = mount();
    await loadWorld(live);
    const lore = '{{user}} owes Vos a debt.';
    expect(live().world.resolvePH(lore)).toBe('The player owes Vos a debt.');
    await act(async () => { live().gameplay.setPersonaRef({ source: 'world', entityId: mira.id }); });
    expect(live().world.resolvePH(lore)).toBe('Mira owes Vos a debt.');
  });
});
