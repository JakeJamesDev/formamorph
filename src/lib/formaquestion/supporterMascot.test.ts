import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT_RIG, type MascotImageRef, type MascotRig } from './mascot';
import { buildMascotCardData } from './mascotCard';
import {
  DEFAULT_MASCOT_ID, deleteMascotPreset, duplicateMascotPreset, linkMascotPreset, mascotAllows, mascotPresetKind, parseMascotPresetStore,
  reconcileSupporterMascots, renameMascotPreset, saveMascotRig, selectMascotPreset, supporterMascotId, type MascotPreset, type MascotPresetStore,
} from './mascotPresets';
import { SUPPORTER_MASCOT_FALLBACK_NAME, supporterLayerOf, supporterMascotFromContent } from './supporterMascot';

const ITEM = { listingId: 'listing-7', revision: 3, accountId: 'account-1' };

const layer = (n: number) => ({ dataUrl: `data:image/png;base64,${btoa(`layer-${n}`)}`, seed: n, version: 1, sourceWidth: 8, sourceHeight: 8 });

/** A Mascot card whose image table holds scrambled layers, as the gated route serves it. */
function contentOf(name: string | null = 'Nova') {
  const card = buildMascotCardData(name ?? '', DEFAULT_MASCOT_RIG, (ref) => `data:image/png;base64,${btoa(ref.kind === 'bundled' ? ref.name : 'x')}`, '3.0.1');
  const { name: _name, ...rest } = card;
  return { ...(name === null ? rest : card), images: card.images.map((_, index) => layer(index)) };
}

const mine: MascotPreset = { id: 'mine', name: 'Mine', rig: DEFAULT_MASCOT_RIG };
const nova = supporterMascotFromContent(ITEM, contentOf());

describe('supporterMascotFromContent', () => {
  it('keeps the card rig and names every image by its place in the table, under the listing and revision', () => {
    expect(nova.id).toBe(supporterMascotId('listing-7'));
    expect(nova.name).toBe('Nova');
    expect(nova.supporter).toEqual(ITEM);
    const refs: MascotImageRef[] = [nova.rig.base, ...nova.rig.layers.flatMap((row) => row.images)];
    expect(refs.every((ref) => ref.kind === 'supporter' && ref.id === 'listing-7' && ref.revision === 3)).toBe(true);
    const { base: _b, layers: rows, ...rest } = nova.rig;
    const { base: _db, layers: defaultRows, ...defaultRest } = DEFAULT_MASCOT_RIG;
    expect(rest).toEqual(defaultRest);
    expect(rows.map((row) => row.name)).toEqual(defaultRows.map((row) => row.name));
  });

  it('takes a fallback name when the card has none', () => {
    expect(supporterMascotFromContent(ITEM, contentOf(null)).name).toBe(SUPPORTER_MASCOT_FALLBACK_NAME);
  });

  it('refuses a card whose table holds a plain data URL, naming the layer', () => {
    const content = contentOf();
    const images = [...content.images] as unknown[];
    images[2] = layer(2).dataUrl;
    expect(() => supporterMascotFromContent(ITEM, { ...content, images })).toThrow('images.2');
    expect(() => supporterMascotFromContent(ITEM, 'nope')).toThrow('not a Mascot card');
  });

  it('finds the scrambled layer a ref names, and none past the table', () => {
    const content = contentOf();
    expect(supporterLayerOf(content, 1)).toEqual(layer(1));
    expect(supporterLayerOf(content, content.images.length)).toBeNull();
    expect(supporterLayerOf(null, 0)).toBeNull();
  });
});

describe('a Supporter mascot in the preset store', () => {
  const store: MascotPresetStore = { activeId: nova.id, mascots: [mine, nova] };
  const other: MascotRig = { ...DEFAULT_MASCOT_RIG, voice: 'Gruff.' };

  it('is its own kind, which takes no preset action', () => {
    expect(mascotPresetKind(store, nova.id)).toBe('supporter');
    expect(mascotPresetKind(store, 'mine')).toBe('custom');
    expect(mascotPresetKind(store, DEFAULT_MASCOT_ID)).toBe('default');
    for (const action of ['edit', 'rename', 'delete', 'duplicate', 'export', 'publish'] as const) expect(mascotAllows('supporter', action)).toBe(false);
  });

  it('refuses a rig save, a rename, a delete, a duplicate and a listing link', () => {
    expect(saveMascotRig(store, nova.id, other)).toBe(store);
    expect(renameMascotPreset(store, nova.id, 'Mine Now')).toBe(store);
    expect(deleteMascotPreset(store, nova.id)).toBe(store);
    expect(duplicateMascotPreset(store, nova.id, 'copy', 'Copy')).toBe(store);
    expect(linkMascotPreset(store, nova.id, { sourceId: 'elsewhere' })).toBe(store);
  });

  it('can be selected', () => {
    expect(selectMascotPreset({ ...store, activeId: 'mine' }, nova.id).activeId).toBe(nova.id);
  });

  it('round-trips through JSON, and drops an entry whose source does not match its id', () => {
    expect(parseMascotPresetStore(JSON.parse(JSON.stringify(store)))).toEqual(store);
    const forged = { ...nova, supporter: { ...ITEM, listingId: 'listing-8' } };
    expect(parseMascotPresetStore({ activeId: nova.id, mascots: [mine, forged] })).toEqual({ activeId: DEFAULT_MASCOT_ID, mascots: [mine] });
    expect(parseMascotPresetStore({ activeId: 'mine', mascots: [mine, { ...nova, supporter: { ...ITEM, accountId: '' } }] }).mascots).toEqual([mine]);
  });
});

describe('reconcileSupporterMascots', () => {
  const newer = supporterMascotFromContent({ ...ITEM, revision: 4 }, contentOf('Nova II'));

  it('adds an installed Supporter mascot after the custom ones and keeps the selection', () => {
    expect(reconcileSupporterMascots({ activeId: 'mine', mascots: [mine] }, [nova])).toEqual({ activeId: 'mine', mascots: [mine, nova] });
  });

  it('replaces a new revision in place and keeps it active', () => {
    expect(reconcileSupporterMascots({ activeId: nova.id, mascots: [mine, nova] }, [newer])).toEqual({ activeId: nova.id, mascots: [mine, newer] });
  });

  it('drops a removed Supporter mascot, and the Default takes over when it was active', () => {
    expect(reconcileSupporterMascots({ activeId: nova.id, mascots: [mine, nova] }, [])).toEqual({ activeId: DEFAULT_MASCOT_ID, mascots: [mine] });
    expect(reconcileSupporterMascots({ activeId: 'mine', mascots: [mine, nova] }, [])).toEqual({ activeId: 'mine', mascots: [mine] });
  });

  it('returns the same store when nothing changed', () => {
    const store = { activeId: nova.id, mascots: [mine, nova] };
    expect(reconcileSupporterMascots(store, [nova])).toBe(store);
  });
});
