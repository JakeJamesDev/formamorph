import { describe, expect, it } from 'vitest';
import { pickLabel, pickToken, placeLibraryPicks, type LibraryVrm, type VrmLookup } from './vrmPickMatch';
import { contentMatchesSource } from './linkedContent';
import { diffContent } from './componentUpdates';
import type { Entity, MediaAsset, VrmPick, WorldVrm } from '@/types';

const file = (name: string): MediaAsset => ({ data: `data:model/vrm;base64,${btoa(name)}`, type: 'model/vrm', name: `${name}.vrm` });
const world = (id: string): VrmPick => ({ kind: 'world', id });
const lib = (id: string): VrmPick => ({ kind: 'library', id });

const lookup: VrmLookup = {
  world: new Map([['w-heron', { name: 'Heron', hash: 'h-heron' }], ['w-reed', { name: 'Reed', hash: 'h-reed' }]]),
  library: new Map([['l-heron', { name: 'Grey Heron', hash: 'h-heron' }], ['l-crane', { name: 'Crane', hash: 'h-crane' }]]),
};

describe('pickToken', () => {
  it('matches a world pick and a library pick that hold the same file', () => {
    expect(pickToken(world('w-heron'), lookup)).toBe(pickToken(lib('l-heron'), lookup));
  });

  it('tells two different files apart', () => {
    expect(pickToken(world('w-reed'), lookup)).not.toBe(pickToken(lib('l-heron'), lookup));
  });

  it("keeps None and User's Default as they are", () => {
    expect(pickToken(undefined, lookup)).toBeUndefined();
    expect(pickToken({ kind: 'default' }, lookup)).toBe('default');
  });

  it('reads a store id the store lacks as none, as the resolver does', () => {
    expect(pickToken(world('gone'), lookup)).toBeUndefined();
  });

  it('matches a library id the library lacks only to itself', () => {
    expect(pickToken(lib('gone'), lookup)).toBe('library:gone');
  });
});

describe('pickLabel', () => {
  it('names each form', () => {
    expect(pickLabel(undefined, lookup)).toBe('None');
    expect(pickLabel({ kind: 'default' }, lookup)).toBe("User's Default");
    expect(pickLabel(world('w-heron'), lookup)).toBe('Heron');
    expect(pickLabel(lib('l-crane'), lookup)).toBe('Crane');
  });
});

describe('placeLibraryPicks', () => {
  const heron: LibraryVrm = { name: 'Grey Heron', hash: 'h-heron', file: file('heron') };
  const crane: LibraryVrm = { name: 'Crane', hash: 'h-crane', file: file('crane') };
  const vrms = new Map([['l-heron', heron], ['l-crane', crane]]);
  const entity = (id: string, vrmPick?: VrmPick): Entity => ({ id, name: id, ...(vrmPick ? { vrmPick } : {}) } as Entity);

  it('embeds a library Avatar once under its library name and hash, and points the pick at it', () => {
    const placed = placeLibraryPicks([entity('a', lib('l-crane')), entity('b', lib('l-crane'))], {}, new Map(), vrms);
    const entries = Object.entries(placed.store ?? {});
    expect(entries).toHaveLength(1);
    const [id, entry] = entries[0];
    expect(entry).toEqual({ name: 'Crane', file: crane.file, hash: 'h-crane' });
    expect(placed.entities.map((e) => e.vrmPick)).toEqual([world(id), world(id)]);
  });

  it('reuses a store entry with the same file instead of embedding a second', () => {
    const store: Record<string, WorldVrm> = { 'w-heron': { name: 'Heron', file: file('heron'), hash: 'h-heron' } };
    const placed = placeLibraryPicks([entity('a', lib('l-heron'))], store, new Map(), vrms);
    expect(placed.store).toBe(store);
    expect(placed.entities[0].vrmPick).toEqual(world('w-heron'));
  });

  it('matches a store entry without a stored hash through the hashes it was read with', () => {
    const store: Record<string, WorldVrm> = { 'legacy-player-avatar': { name: 'Player', file: file('heron') } };
    const placed = placeLibraryPicks([entity('a', lib('l-heron'))], store, new Map([['legacy-player-avatar', 'h-heron']]), vrms);
    expect(placed.store).toBe(store);
    expect(placed.entities[0].vrmPick).toEqual(world('legacy-player-avatar'));
  });

  it('sets a library id the library no longer holds to none', () => {
    const placed = placeLibraryPicks([entity('a', lib('gone'))], {}, new Map(), vrms);
    expect(placed.entities[0]).not.toHaveProperty('vrmPick');
    expect(placed.store).toEqual({});
  });

  it('keeps entities without a library pick as they are', () => {
    const kept = [entity('a', world('w-heron')), entity('b', { kind: 'default' }), entity('c')];
    const placed = placeLibraryPicks(kept, {}, new Map(), vrms);
    placed.entities.forEach((e, i) => expect(e).toBe(kept[i]));
  });
});

describe('a linked copy against its library item', () => {
  const copy = (vrmPick?: VrmPick) => ({ id: 'copy', name: 'Wren', ...(vrmPick ? { vrmPick } : {}) }) as Entity;
  const item = (vrmPick?: VrmPick) => ({ id: 'item', name: 'Wren', ...(vrmPick ? { vrmPick } : {}) }) as Entity;

  it('matches when both show the same file', () => {
    expect(contentMatchesSource(copy(world('w-heron')), item(lib('l-heron')), undefined, lookup)).toBe(true);
  });

  it('differs when the files differ', () => {
    expect(contentMatchesSource(copy(world('w-reed')), item(lib('l-heron')), undefined, lookup)).toBe(false);
  });

  it('differs when the item dropped its Avatar', () => {
    expect(contentMatchesSource(copy(world('w-heron')), item(), undefined, lookup)).toBe(false);
  });

  it('shows a changed pick in the review as one Avatar row with both names', () => {
    const diff = diffContent(copy(world('w-reed')), item(lib('l-heron')), lookup);
    expect(diff.changed).toContainEqual({ field: 'vrmPick', label: 'Avatar', current: 'Reed', incoming: 'Grey Heron' });
  });

  it('shows a pick the item set to none', () => {
    const diff = diffContent(copy(world('w-heron')), item(), lookup);
    expect(diff.changed).toContainEqual({ field: 'vrmPick', label: 'Avatar', current: 'Heron', incoming: 'None' });
  });

  it('lists the same Avatar under unchanged content', () => {
    const diff = diffContent(copy(world('w-heron')), item(lib('l-heron')), lookup);
    expect(diff.changed.find((row) => row.field === 'vrmPick')).toBeUndefined();
    expect(diff.unchanged).toContainEqual({ field: 'vrmPick', label: 'Avatar', current: 'Heron', incoming: 'Grey Heron' });
  });
});
