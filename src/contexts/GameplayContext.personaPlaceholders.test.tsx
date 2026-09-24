// Real in-memory storage for saves and the entity library; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider, useGameData } from './GameDataContext';
import { PlaceholderSessionProvider, usePlaceholderSession } from './PlaceholderSessionContext';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { PROMPT_TEXT_DEFAULTS } from '@/components/game/GamePrompts';
import { renderPromptTemplate } from '@/lib/promptTemplate';
import { chipValues } from '@/lib/chipValues/chipValues';
import { encodePlaceholderToken, newPlaceholder } from '@/lib/placeholders';
import EntityStorageService from '@/services/EntityStorageService';
import { worldFixture } from '@/test/gamePanels';
import type { Entity } from '@/types';

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

const chip = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });

const TOWN = newPlaceholder('Town', ['Sedge', 'Marrow']);
// Many values, so a redraw would almost surely land on a different one.
const EYE_COLORS = Array.from({ length: 40 }, (_, i) => `hue-${i}`);
const EYES = newPlaceholder('Eyes', EYE_COLORS);
const SCAR = newPlaceholder('Scar', Array.from({ length: 40 }, (_, i) => `mark-${i}`));

const wren: Entity = {
  id: 'l-wren', name: 'Wren', persona: true,
  aiDescription: `Wren has ${chip(EYES.id, 'p-eyes')} eyes.`,
  placeholders: [EYES],
};
const ash: Entity = {
  id: 'l-ash', name: 'Ash', persona: true,
  aiDescription: `Ash bears a ${chip(SCAR.id, 'p-scar')} scar.`,
  placeholders: [SCAR],
};
const plain: Entity = { id: 'l-plain', name: 'Plain', persona: true, aiDescription: 'Nothing to roll.' };

const store = (entity: Entity) => EntityStorageService.storeEntity({ id: entity.id, name: entity.name, data: entity });

/** Opens a session on a world with one Wildcard of its own, then plays `persona`. */
const start = async (persona: Entity) => {
  await EntityStorageService.initialize();
  await store(persona);
  const live = mount();
  await act(async () => {
    live().gameData.loadWorldData(worldFixture({ placeholders: [TOWN], entities: [] }));
    live().session.beginSession();
  });
  await act(async () => { live().gameplay.setPersonaRef({ source: 'library', entityId: persona.id }); });
  await waitFor(() => expect(live().world.persona?.entity.id).toBe(persona.id));
  return live;
};

/** The default narration prompt as a turn sends it: the chip values of a scene holding the live persona
 *  and resolution, and nothing else. */
const narrationPrompt = (live: () => Live): string => renderPromptTemplate(PROMPT_TEXT_DEFAULTS.systemPrompt, chipValues({
  overview: '', stats: [], traits: [], traitGroups: [], location: null, locations: [], connections: [], entities: [],
  presentIds: [], inSceneIds: [], lore: [], notes: '', time: null,
  persona: live().world.persona, resolve: live().world.resolvePH,
}));

/** The eye color the prompt names, or null when the chip did not resolve to one. */
const eyesIn = (prompt: string) => prompt.match(/Wren has (hue-\d+) eyes\./)?.[1] ?? null;

describe('a library persona with placeholders of its own', () => {
  it('resolves its Wildcard in the rendered prompt and keeps one value across turns', async () => {
    const live = await start(wren);
    await waitFor(() => expect(eyesIn(narrationPrompt(live))).not.toBeNull());
    const first = eyesIn(narrationPrompt(live))!;
    expect(live().gameplay.placeholderRolls.world?.[EYES.id]).toBe(first);

    // A turn's state writes, then an undo back to it: the persona reads the same roll throughout.
    const snapshot = live().gameplay.saveCurrentGameState();
    await act(async () => { live().gameplay.setPlayerStats([]); });
    expect(eyesIn(narrationPrompt(live))).toBe(first);
    await act(async () => { live().gameplay.loadGameState(snapshot, [], { keepLiveHistory: true }); });
    expect(eyesIn(narrationPrompt(live))).toBe(first);
  });

  it('joins the session set on the read side only, leaving the authored world untouched', async () => {
    const live = await start(wren);
    await waitFor(() => expect(live().session.placeholders.map((p) => p.name)).toEqual(['Town', 'Eyes']));
    expect(live().gameData.placeholders.map((p) => p.name)).toEqual(['Town']);
  });

  it('keeps the old rolls through a switch away and back', async () => {
    await store(ash);
    const live = await start(wren);
    await waitFor(() => expect(eyesIn(narrationPrompt(live))).not.toBeNull());
    const eyes = eyesIn(narrationPrompt(live));

    await act(async () => { live().gameplay.setPersonaRef({ source: 'library', entityId: ash.id }); });
    await waitFor(() => expect(live().gameplay.placeholderRolls.world?.[SCAR.id]).toBeDefined());
    expect(narrationPrompt(live)).toContain(`Ash bears a ${live().gameplay.placeholderRolls.world?.[SCAR.id]} scar.`);
    expect(live().gameplay.placeholderRolls.world?.[EYES.id]).toBe(eyes);

    await act(async () => { live().gameplay.setPersonaRef({ source: 'library', entityId: wren.id }); });
    await waitFor(() => expect(live().world.persona?.entity.id).toBe(wren.id));
    expect(eyesIn(narrationPrompt(live))).toBe(eyes);
  });

  it('keeps its rolls through a save and a reload', async () => {
    const live = await start(wren);
    await waitFor(() => expect(eyesIn(narrationPrompt(live))).not.toBeNull());
    const eyes = eyesIn(narrationPrompt(live));
    await act(async () => { await live().gameplay.saveGame('slot', 'World', 'w1', 'persona-rolls'); });

    await act(async () => {
      live().session.endSession();
      live().gameplay.setPersonaRef(undefined);
    });
    await act(async () => { live().session.beginSession(); });
    await act(async () => { await live().gameplay.loadGame('persona-rolls', []); });
    await waitFor(() => expect(live().world.persona?.entity.id).toBe(wren.id));
    expect(eyesIn(narrationPrompt(live))).toBe(eyes);
  });

  it('lets a pin mask its roll, and brings the roll back when the pin goes', async () => {
    const live = await start(wren);
    await waitFor(() => expect(eyesIn(narrationPrompt(live))).not.toBeNull());
    const eyes = eyesIn(narrationPrompt(live));
    const pinned = EYE_COLORS.find((c) => c !== eyes)!;

    await act(async () => { live().gameplay.setCodePins({ [EYES.id]: pinned }); });
    expect(eyesIn(narrationPrompt(live))).toBe(pinned);
    await act(async () => { live().gameplay.setCodePins({}); });
    expect(eyesIn(narrationPrompt(live))).toBe(eyes);
  });

  it('resolves the chips in its name and aliases for the side panel and the planner', async () => {
    const titled: Entity = { ...wren, name: `Wren the ${chip(EYES.id, 'p-name')}`, aliases: [`${chip(EYES.id, 'p-alias')} Eye`] };
    const live = await start(titled);
    await waitFor(() => expect(live().gameplay.placeholderRolls.world?.[EYES.id]).toBeDefined());
    const eyes = live().gameplay.placeholderRolls.world?.[EYES.id];
    expect(live().world.persona?.entity.name).toBe(`Wren the ${eyes}`);
    expect(live().world.playerNames).toEqual([`Wren the ${eyes}`, `${eyes} Eye`]);
  });

  it('changes nothing for a persona with no placeholders', async () => {
    const live = await start(plain);
    await waitFor(() => expect(narrationPrompt(live)).toContain('Nothing to roll.'));
    expect(live().session.placeholders).toBe(live().gameData.placeholders);
  });
});

describe('drawing a persona’s rolls when it is set', () => {
  it('returns the rolls at once, so page one reads what later turns read', async () => {
    await EntityStorageService.initialize();
    const live = mount();
    await act(async () => {
      live().gameData.loadWorldData(worldFixture({ placeholders: [TOWN], entities: [] }));
      live().session.beginSession();
    });
    let drawn: ReturnType<Live['session']['setPersona']> = {};
    await act(async () => { drawn = live().session.setPersona(wren); });
    expect(EYE_COLORS).toContain(drawn.world?.[EYES.id]);
    expect(live().session.rolls.world?.[EYES.id]).toBe(drawn.world?.[EYES.id]);
  });

  it('names the persona on page one with the value later turns read', async () => {
    const titled: Entity = { ...wren, name: `Wren the ${chip(EYES.id, 'p-title')}` };
    await EntityStorageService.initialize();
    await store(titled);
    const live = mount();
    await act(async () => {
      live().gameData.loadWorldData(worldFixture({ placeholders: [TOWN], entities: [] }));
      live().session.beginSession();
    });

    // The seed step: the reference and the draw land in one pass, before either is in state.
    let pageOne = '';
    await act(async () => {
      live().gameplay.setPersonaRef({ source: 'library', entityId: titled.id });
      const rolls = live().session.setPersona(titled);
      pageOne = live().world.resolveOpening('{{user}} steps off the boat.', {
        persona: { entity: titled, source: 'library' }, rolls,
      });
    });
    expect(pageOne).toMatch(/^Wren the hue-\d+ steps off the boat\.$/);

    await waitFor(() => expect(live().world.persona?.entity.id).toBe(titled.id));
    expect(live().world.resolveOpening('{{user}} steps off the boat.')).toBe(pageOne);
  });
});

describe('a world persona with placeholders of its own', () => {
  const keeper: Entity = {
    id: 'w-keeper', name: 'Keeper', persona: true, locations: ['dock'],
    aiDescription: `Keeper has ${chip(EYES.id, 'k-eyes')} eyes.`,
    placeholders: [EYES],
  };

  it('resolves them as it did in the cast, with the same roll', async () => {
    await EntityStorageService.initialize();
    const live = mount();
    await act(async () => {
      live().gameData.loadWorldData(worldFixture({ placeholders: [TOWN], entities: [keeper] }));
      live().session.beginSession();
    });
    // A cast member's text resolves when a prompt reads it.
    const resolvedInCast = () => live().world.resolvePH(live().world.entities[0]?.aiDescription ?? '');
    await waitFor(() => expect(resolvedInCast()).toMatch(/^Keeper has hue-\d+ eyes\.$/));
    const inCast = resolvedInCast();

    await act(async () => { live().gameplay.setPersonaRef({ source: 'world', entityId: keeper.id }); });
    await waitFor(() => expect(live().world.persona?.entity.id).toBe(keeper.id));
    expect(narrationPrompt(live)).toContain(inCast);
    expect(live().world.entities).toEqual([]);
  });
});
