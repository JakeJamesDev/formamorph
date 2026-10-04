import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT_RIG, type MascotImageRef, type MascotRig } from './mascot';
import {
  DEFAULT_MASCOT_ID, EMPTY_MASCOT_PRESET_STORE, activeMascotRig, addMascotPreset, deleteMascotPreset, duplicateMascotPreset, isDefaultMascot,
  parseMascotPresetStore, renameMascotPreset, saveMascotRig, selectMascotPreset, uniqueMascotName, unreferencedMascotImages, type MascotPresetStore,
} from './mascotPresets';

const stored = (id: string): MascotImageRef => ({ kind: 'stored', id });
const rigWith = (base: string, ...overlays: string[]): MascotRig => ({
  ...DEFAULT_MASCOT_RIG,
  base: stored(base),
  layers: [{ id: 'hi', name: 'Hi', kind: 'state', enabled: true, images: overlays.map(stored) }],
});
const storeOf = (...mascots: { id: string; name: string; rig: MascotRig }[]): MascotPresetStore => ({ activeId: mascots[0]?.id ?? DEFAULT_MASCOT_ID, mascots });

describe('the mascot preset store', () => {
  it('starts on the Default, which draws the code rig and refuses edits', () => {
    expect(activeMascotRig(EMPTY_MASCOT_PRESET_STORE)).toBe(DEFAULT_MASCOT_RIG);
    expect(isDefaultMascot(EMPTY_MASCOT_PRESET_STORE, DEFAULT_MASCOT_ID)).toBe(true);
    expect(saveMascotRig(EMPTY_MASCOT_PRESET_STORE, DEFAULT_MASCOT_ID, rigWith('a'))).toBe(EMPTY_MASCOT_PRESET_STORE);
    expect(renameMascotPreset(EMPTY_MASCOT_PRESET_STORE, DEFAULT_MASCOT_ID, 'Mine')).toBe(EMPTY_MASCOT_PRESET_STORE);
  });

  it('duplicates a mascot under a new id, sharing its image ids, and selects the copy', () => {
    const mine = { id: 'mine', name: 'Mine', rig: rigWith('a', 'b') };
    const next = duplicateMascotPreset(storeOf(mine), 'mine', 'copy', 'Mine (copy)');
    expect(next.activeId).toBe('copy');
    expect(next.mascots.map((mascot) => mascot.name)).toEqual(['Mine', 'Mine (copy)']);
    expect(activeMascotRig(next)).toEqual(mine.rig);
  });

  it('duplicates the Default into an editable mascot', () => {
    const next = duplicateMascotPreset(EMPTY_MASCOT_PRESET_STORE, DEFAULT_MASCOT_ID, 'copy', 'Default (copy)');
    expect(isDefaultMascot(next, 'copy')).toBe(false);
    expect(activeMascotRig(saveMascotRig(next, 'copy', rigWith('a')))).toEqual(rigWith('a'));
  });

  it('deletes a mascot, falls back to the Default, and leaves only the images no other mascot holds to delete', () => {
    const store = storeOf({ id: 'one', name: 'One', rig: rigWith('a', 'b') }, { id: 'two', name: 'Two', rig: rigWith('a') });
    const next = deleteMascotPreset(store, 'one');
    expect(next.activeId).toBe(DEFAULT_MASCOT_ID);
    expect(unreferencedMascotImages(['a', 'b'], next)).toEqual(['b']);
    expect(deleteMascotPreset(next, DEFAULT_MASCOT_ID)).toBe(next);
  });

  it('keeps the active mascot when another one is deleted', () => {
    const store = selectMascotPreset(storeOf({ id: 'one', name: 'One', rig: DEFAULT_MASCOT_RIG }, { id: 'two', name: 'Two', rig: DEFAULT_MASCOT_RIG }), 'two');
    expect(deleteMascotPreset(store, 'one').activeId).toBe('two');
  });

  it('numbers a name already in use, the Default included', () => {
    const store = addMascotPreset(storeOf({ id: 'one', name: 'Friend', rig: DEFAULT_MASCOT_RIG }), { id: 'two', name: 'Friend 2', rig: DEFAULT_MASCOT_RIG });
    expect(uniqueMascotName(store, 'Captain')).toBe('Captain');
    expect(uniqueMascotName(store, 'Friend')).toBe('Friend 3');
    expect(uniqueMascotName(store, 'Default')).toBe('Default 2');
  });

  it('selects the Default for an id no mascot holds', () => {
    expect(selectMascotPreset(storeOf({ id: 'one', name: 'One', rig: DEFAULT_MASCOT_RIG }), 'gone').activeId).toBe(DEFAULT_MASCOT_ID);
  });
});

describe('parseMascotPresetStore', () => {
  it('round-trips a store through JSON', () => {
    const store = selectMascotPreset(storeOf({ id: 'one', name: 'One', rig: rigWith('a', 'b') }, { id: 'two', name: 'Two', rig: DEFAULT_MASCOT_RIG }), 'two');
    expect(parseMascotPresetStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
  });

  it('reads a missing or malformed value as the Default with no custom mascots', () => {
    for (const value of [undefined, null, 'mine', [], { activeId: 'one' }]) expect(parseMascotPresetStore(value)).toEqual(EMPTY_MASCOT_PRESET_STORE);
  });

  it('drops a bad mascot, a repeated id and a stored Default, and reads a lost active id as the Default', () => {
    const value = {
      activeId: 'broken',
      mascots: [
        { id: 'one', name: 'One', rig: DEFAULT_MASCOT_RIG },
        { id: 'broken', name: 5, rig: DEFAULT_MASCOT_RIG },
        { id: 'one', name: 'Again', rig: DEFAULT_MASCOT_RIG },
        { id: DEFAULT_MASCOT_ID, name: 'Default', rig: DEFAULT_MASCOT_RIG },
      ],
    };
    expect(parseMascotPresetStore(value)).toEqual({ activeId: DEFAULT_MASCOT_ID, mascots: [{ id: 'one', name: 'One', rig: DEFAULT_MASCOT_RIG }] });
  });
});
