// Real in-memory storage for saves and the entity library; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from '@/contexts/GameplayContext';
import { GameDataProvider, useGameData } from '@/contexts/GameDataContext';
import { PlaceholderSessionProvider, usePlaceholderSession } from '@/contexts/PlaceholderSessionContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { worldFixture } from '@/test/gamePanels';
import { phValues } from '@/test/placeholderValues';
import type { Entity, Placeholder } from '@/types';
import { contributionBody } from './correctionContribution';
import { narrationHash } from './mentionReadings';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

interface Live {
  gameplay: ReturnType<typeof useGameplay>;
  gameData: ReturnType<typeof useGameData>;
  session: ReturnType<typeof usePlaceholderSession>;
  world: ReturnType<typeof useResolvedWorld>;
}

const Expose = ({ expose }: { expose: (l: Live) => void }) => {
  expose({ gameplay: useGameplay(), gameData: useGameData(), session: usePlaceholderSession(), world: useResolvedWorld() });
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

// A synthetic passage and world written for these guards.
const PASSAGE = 'The keeper met the courier. She nodded at you.';
const span = (piece: string): [number, number] => [PASSAGE.indexOf(piece), PASSAGE.indexOf(piece) + piece.length];
const title: Placeholder = { id: 'title', name: 'Keeper Title', values: phValues(['Warden', 'Steward']) };
const keeper: Entity = { id: 'keeper', name: '{{ph:title:world:t1}} Mira' };
const wren: Entity = { id: 'wren', name: '{{ph:title:world:t1}} Wren', persona: true };

describe('the names a contribution sends', () => {
  it('are the names play resolved, the persona included, never a placeholder token', async () => {
    const live = mount();
    await act(async () => { live().gameData.loadWorldData(worldFixture({ entities: [keeper, wren], placeholders: [title] })); });
    await act(async () => { live().session.beginSession({ world: { title: 'Steward' } }); });
    await act(async () => { live().gameplay.setPersonaRef({ source: 'world', entityId: wren.id }); });
    const { entities, persona } = live().world;

    const body = contributionBody({
      worldId: 'world-1',
      passage: PASSAGE,
      entry: {
        model: 'big', version: 3, textHash: narrationHash(PASSAGE), reading: { mentions: [], quotes: [] },
        clusters: [[span('The keeper'), span('She')], [span('you')]], clusterEntities: ['keeper', 'wren'],
      },
      corrections: [{ kind: 'mention', start: span('She')[0], end: span('She')[1], entityId: 'keeper' }],
      entities,
      persona: persona?.entity,
    });
    expect(body?.entityNames).toEqual({ keeper: 'Steward Mira', wren: 'Steward Wren' });
  });
});

// A source scan, since the game view is too large to mount: the send reads the cast the reading names clusters with.
describe('the game view names a contribution from the resolved world', () => {
  const viewer = readFileSync(join(process.cwd(), 'src/views/GameViewer.tsx'), 'utf8');

  it('passes the reading cast and the resolved persona', () => {
    expect(viewer).toMatch(/entities: allEntities,\s*persona: personaEntity,/);
    expect(viewer).toMatch(/const personaEntity = persona\?\.entity;/);
    expect(viewer).toMatch(/const allEntities = useMemo\(\s*\(\) => \[\.\.\.entities, /);
    expect(viewer).toMatch(/cast: allEntities,/);
  });
});
