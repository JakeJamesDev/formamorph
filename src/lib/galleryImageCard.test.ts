import { describe, it, expect } from 'vitest';
import type { Entity, GalleryImage, Stat, TraitRequirement, TraitRequirementRow } from '@/types';
import { buildEntityCardData, importCharacterFile, parseEntityCardData } from './entityFile';
import { embedEntityCard } from './entityCard';
import { bytesToDataUrl } from './imageOptim';
import { adoptOwnedTraits, bindOwnedRules, bindOwnedTraits, comparableOwnedTraits, SELF_ENTITY, type TraitWorld } from './portableTraits';
import { remintOwnedTraits } from './ownedTraits';
import { conditionsOf } from './requirementRows';
import { contentMatchesSource } from './linkedContent';

const S = (id: string, name: string): Stat => ({ id, name, type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] });
const row = (...all: TraitRequirement[]): TraitRequirementRow[] => [{ all }];

const A = 'data:image/webp;base64,AAAA';
const B = 'data:image/webp;base64,BBBB';
const C = 'data:image/webp;base64,CCCC';

const hurt: TraitRequirement = { kind: 'stat', id: 'hp', operator: '<', value: 20, unit: 'percent' };
const knight: TraitRequirement = { kind: 'trait', id: 't-knight' };
const paladin: TraitRequirement = { kind: 'trait', id: 'w-paladin', owner: { kind: 'you' } };
// A global stat Condition names no owner; a You one binds among the played entity's stats (Q33).
const rage: TraitRequirement = { kind: 'stat', id: 'w-rage', operator: '>=', value: 80, unit: 'raw', not: true };

const wren = (images: GalleryImage[]): Entity => ({
  id: 'wren', name: 'Wren',
  stats: [S('hp', 'Health')],
  traits: [{ id: 't-knight', name: 'Knight', statChanges: [] }],
  images,
});
const home: TraitWorld = {
  traits: [{ id: 'w-paladin', name: 'Paladin', statChanges: [] }], traitGroups: [], entities: [],
  stats: [S('w-rage', 'Rage')], statGroups: [],
};

/** The entity through the card's text alone, as an embedded payload is read back. */
const throughText = (entity: Entity, pixels?: string) =>
  parseEntityCardData(JSON.parse(JSON.stringify(buildEntityCardData(entity, [], {}, undefined, home))), pixels);

// A minimal simple-lossy WebP container to embed into (framing only; the bitstream bytes are arbitrary).
function fakeWebp(): Uint8Array {
  const payload = [1, 2, 3, 4];
  const out = new Uint8Array(12 + 8 + payload.length);
  const view = new DataView(out.buffer);
  const put4 = (s: string, at: number) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  put4('RIFF', 0);
  view.setUint32(4, out.length - 8, true);
  put4('WEBP', 8);
  put4('VP8 ', 12);
  view.setUint32(16, payload.length, true);
  out.set(payload, 20);
  return out;
}

describe('a character card’s gallery', () => {
  it('imports a card whose extras are data strings, the card pixels leading', () => {
    const parsed = parseEntityCardData({ formamorphKind: 'entity', name: 'Old', extraImages: [B, '', C, 7] }, A);
    expect(parsed.images).toEqual([{ data: A }, { data: B }, { data: C }]);
  });

  it('round-trips every image’s rule through a card file, slot 0’s riding beside the extras', async () => {
    const entity = wren([{ data: A, requires: row(hurt) }, { data: B, requires: row(knight) }, { data: C }]);
    const json = JSON.stringify(buildEntityCardData(entity, [], {}, undefined, home));
    const bytes = embedEntityCard(fakeWebp(), json, { w: 4, h: 4 });
    const { entity: imported } = await importCharacterFile(new File([bytes], 'wren.webp', { type: 'image/webp' }));

    const card = JSON.parse(json);
    expect(card.primaryImageRequires).toEqual(row(hurt));
    expect(card.extraImages).toEqual([{ data: B, requires: row(knight) }, { data: C }]);
    expect(imported.images).toEqual([
      { data: bytesToDataUrl(bytes, 'image/webp'), requires: row(hurt) },
      { data: B, requires: row(knight) },
      { data: C },
    ]);
  });

  it('writes no slot 0 field when slot 0 carries no rule', () => {
    expect(buildEntityCardData(wren([{ data: A }, { data: B, requires: row(knight) }]))).not.toHaveProperty('primaryImageRequires');
  });

  it('reads an image’s rule as the card reads a trait’s: a malformed Condition and the row it empties drop', () => {
    const parsed = parseEntityCardData({
      formamorphKind: 'entity', name: 'X',
      primaryImageRequires: [{ all: [{ kind: 'mood', id: 'x' }] }],
      extraImages: [{ data: B, requires: [{ all: [knight, { kind: 'stat', id: 'hp', operator: '=>', value: 1, unit: 'raw' }] }] }, { requires: row(knight) }],
    }, A);
    expect(parsed.images).toEqual([{ data: A }, { data: B, requires: row(knight) }]);
  });

  it('names an outward Condition on the way out and binds it by name on the way in (Q29)', () => {
    const carried = throughText(wren([{ data: A, requires: row(paladin, rage) }]), A);
    expect(conditionsOf(carried.images?.[0].requires)).toEqual([{ ...paladin, name: 'Paladin' }, { ...rage, name: 'Rage' }]);

    const world = (traitId: string, statId: string): TraitWorld => ({
      ...home, traits: [{ id: traitId, name: 'Paladin', statChanges: [] }], stats: [S(statId, 'Rage')],
    });
    const ids = (w: TraitWorld) => conditionsOf(bindOwnedTraits(carried, w).images?.[0].requires).map((r) => r.id);
    expect(ids(world('n-paladin', 'n-rage'))).toEqual(['n-paladin', 'n-rage']);
    expect(ids({ ...home, traits: [], stats: [] })).toEqual(['', '']);
  });

  it('keeps a Condition on the entity’s own trait or stat by id', () => {
    const carried = throughText(wren([{ data: A, requires: row(knight, hurt) }]), A);
    expect(bindOwnedTraits(carried, home).images?.[0].requires).toEqual(row(knight, hurt));
  });

  it('carries "playing as" the entity itself to the copy it becomes', () => {
    const self: TraitRequirement = { kind: 'playingAs', id: 'wren' };
    const card = buildEntityCardData(wren([{ data: A }, { data: B, requires: row(self) }]), [], {}, undefined, home);
    expect(card.extraImages?.[0].requires).toEqual(row({ ...self, id: SELF_ENTITY, name: 'Wren' }));
    const copy = { ...parseEntityCardData(JSON.parse(JSON.stringify(card)), A), id: 'copy' };
    expect(conditionsOf(bindOwnedTraits(copy, home).images?.[1].requires)[0].id).toBe('copy');
  });

  it('follows the entity’s own trait when its ids are minted fresh', () => {
    const reminted = remintOwnedTraits(wren([{ data: A, requires: row(knight, paladin) }]));
    const knightId = reminted.traits?.[0].id;
    expect(knightId).not.toBe('t-knight');
    expect(conditionsOf(reminted.images?.[0].requires).map((r) => r.id)).toEqual([knightId, 'w-paladin']);
  });

  it('re-points the rule when a world already holds the entity’s trait ids', () => {
    const carried = throughText(wren([{ data: A, requires: row(knight) }]), A);
    const taken: TraitWorld = { ...home, entities: [{ id: 'other', name: 'Other', traits: [{ id: 't-knight', name: 'Knight', statChanges: [] }] }] };
    const added = adoptOwnedTraits(carried, taken);
    expect(conditionsOf(added.images?.[0].requires)[0].id).toBe(added.traits?.[0].id);
    expect(added.traits?.[0].id).not.toBe('t-knight');
  });

  it('compares two copies’ rules by the names they store, and tells a changed rule apart', () => {
    const away: TraitWorld = { ...home, traits: [{ id: 'n-paladin', name: 'Paladin', statChanges: [] }] };
    // Both sides bind to the copy's world first, so an owner that world drops (Q19) cannot tell them apart.
    const copy = (images: GalleryImage[]) => comparableOwnedTraits(bindOwnedRules(throughText(wren(images), A), away));
    const local = comparableOwnedTraits(bindOwnedTraits(throughText(wren([{ data: A, requires: row(paladin) }]), A), away));
    expect(local).toEqual(copy([{ data: A, requires: row(paladin) }]));
    expect(local).not.toEqual(copy([{ data: A, requires: row({ ...paladin, not: true }) }]));
    expect(comparableOwnedTraits(wren([{ data: A }]))).not.toHaveProperty('images');
  });

  it('reads a world copy of a trait-less entity as matching its library source when only the rule’s ids differ', () => {
    const plain: Entity = { id: 'bo', name: 'Bo', images: [{ data: A, requires: row(paladin) }] };
    const source = throughText(plain, A);
    const away: TraitWorld = { ...home, traits: [{ id: 'n-paladin', name: 'Paladin', statChanges: [] }] };
    const copy = bindOwnedTraits(source, away);
    expect(conditionsOf(copy.images?.[0].requires)[0].id).toBe('n-paladin');
    // The world drops the source's `you` owner on the global Paladin; the comparison binds the source the same way.
    expect(conditionsOf(copy.images?.[0].requires)[0]).not.toHaveProperty('owner');
    expect(contentMatchesSource(copy, source, away)).toBe(true);
    expect(contentMatchesSource(copy, source)).toBe(false);
  });

  it('reads an unmigrated world-file copy with data-string pictures as matching its library source', () => {
    const source: Entity = { id: 'bo', name: 'Bo', images: [{ data: A }, { data: B }] };
    const fromFile = { ...source, images: [A, B] } as unknown as Entity;
    expect(contentMatchesSource(fromFile, source)).toBe(true);
    expect(contentMatchesSource({ ...source, images: [{ data: B }, { data: A }] }, source)).toBe(false);
  });
});
