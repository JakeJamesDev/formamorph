import { describe, expect, it } from 'vitest';
import type { ChipScene } from '@/lib/chipValues/chipScene';
import { chipValues } from '@/lib/chipValues/chipValues';
import { sampleChipScene } from '@/lib/chipValues/sampleScene';
import type { SandboxState } from '@/lib/statCodeTurn';
import type { GameState, Item, ItemCopy } from '@/types';
import { playerViewPages } from './gameWorld';
import { buildPlayerView, unidentifiedRowId } from './playerView';
import { playerViewScene, playerViewState, type PlayerViewReach } from './playerViewWorld';

const RING: Item = {
  id: 'ring', name: 'Ring of Curses', playerDescription: 'It binds the wearer.', aiDescription: 'Cursed by the lich.',
  unidentifiedName: 'Plain Ring', unidentifiedDescription: 'A dull band.', statEffects: [], traitEffects: [], equipRequires: [],
};
const copy = (id: string, unidentified: boolean): ItemCopy => ({
  id, item: { kind: 'item', itemId: 'ring' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible', ...(unidentified && { state: { unidentified: true } }),
});
const state = (itemCopies: ItemCopy[]): GameState => ({
  globalStats: [], globalTraits: [], visibleEntities: [], logEntries: [], gameplayText: '', gameTime: 0, characterData: null, choices: [],
  isGameStarted: true, timestamp: '', worldName: null, playerNotes: '', previousStateIndex: null, stateVersion: 1, itemCopies,
});
const reach = (copies: ItemCopy[]): PlayerViewReach => {
  const current = state(copies);
  const view = buildPlayerView({
    world: { entities: [], locations: [], traits: [], items: [RING] }, chain: [current], history: [], persona: null, resolve: (text) => text,
  });
  return { view, current };
};
const TRUE_FACE = /Ring of Curses|binds the wearer|lich/;

describe('the player view of an unidentified item (Q19, Q40)', () => {
  it('holds only the unidentified face, under a row id of its own', () => {
    const { view } = reach([copy('a', true)]);
    expect(view.items).toEqual([{ kind: 'item', id: unidentifiedRowId('ring'), name: 'Plain Ring', description: 'A dull band.' }]);
    expect(JSON.stringify(playerViewPages(view))).not.toMatch(TRUE_FACE);
  });

  it('splits an identified and an unidentified copy of one item into two rows that never link', () => {
    const { view } = reach([copy('a', false), copy('b', true)]);
    expect(view.items.map((row) => [row.id, row.name])).toEqual([['ring', 'Ring of Curses'], [unidentifiedRowId('ring'), 'Plain Ring']]);
  });

  it('keeps the true face out of the scene, the Inventory chip and the script state', () => {
    const at = reach([copy('a', true)]);
    const scene: ChipScene = { ...sampleChipScene(), items: [RING], itemCopies: [copy('a', true)] };
    const cut = playerViewScene(scene, at);
    expect((cut.items ?? []).map((item) => [item.id, item.name])).toEqual([[unidentifiedRowId('ring'), 'Plain Ring']]);
    expect(cut.itemCopies?.map((c) => c.item)).toEqual([{ kind: 'item', itemId: unidentifiedRowId('ring') }]);
    expect(chipValues(cut)('<INVENTORY|markdown>')).toContain('Plain Ring');
    expect(JSON.stringify(cut.items ?? []) + chipValues(cut)('<INVENTORY|markdown>')).not.toMatch(TRUE_FACE);

    const script = playerViewState({
      stats: [], enabled: {}, clock: {}, items: [RING], itemCopies: [copy('a', true)],
      ownerTraits: { acquired: [], disabledTraitIds: [], appliedValues: {}, world: { traits: [], groups: [], items: [RING], itemCopies: [copy('a', true)] } },
    } as unknown as SandboxState, at);
    expect(JSON.stringify(script)).not.toMatch(TRUE_FACE);
    expect(script.items?.map((item) => item.name)).toEqual(['Plain Ring']);
  });
});
