import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT_RIG, type MascotImageRef, type MascotLayer, type MascotLayerKind, type MascotRig } from './mascot';
import { buildMascotCardData, mascotCardName, mascotRigFromCard, parseMascotCardData, MASCOT_CARD_VERSION } from './mascotCard';

const img = (id: string): MascotImageRef => ({ kind: 'stored', id });

const row = (id: string, kind: MascotLayerKind, images: string[], enabled = true): MascotLayer =>
  ({ id, name: id.toUpperCase(), kind, enabled, images: images.map(img) });

/** A rig with a shared image, a disabled layer and a pick at a missing layer, so every field has something to carry. */
const rig: MascotRig = {
  base: img('body'),
  layers: [
    row('wave', 'state', ['arm', 'hand']),
    row('smile', 'expression', ['mouth', 'eyes']),
    row('grin', 'expression', ['mouth'], false),
  ],
  mask: { x: 10, y: 0, width: 300, height: 280 },
  picks: {
    initial: { expression: null, state: 'wave' },
    idle: { expression: 'smile', state: null },
    thinking: { expression: 'gone', state: 'wave' },
  },
  voice: 'Dry and short.',
  transition: { mode: 'dissolve', jelly: { durationMs: 600, squash: 0.3, overshoot: 0.2, settle: 1 }, dissolve: { durationMs: 400 } },
};

/** Each image's pixels as a data URL; `mouth` and `grin-mouth` would be equal art under two ids. */
const dataOf = (ref: MascotImageRef): string => `data:image/png;base64,${btoa(ref.kind === 'stored' ? ref.id : ref.name)}`;

const build = (from: MascotRig = rig) => buildMascotCardData('Captain', from, dataOf, '3.0.1');

/** The card as a reader would receive it: through JSON text. */
const throughJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const DELETE = Symbol('delete');

/** A built card, through JSON, with the value at the dotted `path` set to `value` or deleted. */
function edited(path: string, value: unknown): unknown {
  const card = throughJson(build());
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], card) as Record<string, unknown>;
  if (value === DELETE) delete parent[last];
  else parent[last] = value;
  return card;
}

const refusal = (field: string) => `This mascot card has a missing or bad field: ${field}.`;

describe('the mascot card data', () => {
  it('round-trips the whole rig, with each image back in its place', () => {
    const card = parseMascotCardData(throughJson(build()));
    // The store mints one id per carried image; `stored-n` stands in for them here.
    const ids = card.images.map((_, index) => `stored-${index}`);
    const back = mascotRigFromCard(card, ids);
    const dataAt = (ref: MascotImageRef) => (ref.kind === 'stored' ? card.images[ids.indexOf(ref.id)] : null);
    expect({ ...back, base: undefined, layers: back.layers.map((layer) => ({ ...layer, images: [] })) })
      .toEqual({ ...rig, base: undefined, layers: rig.layers.map((layer) => ({ ...layer, images: [] })) });
    expect(dataAt(back.base)).toBe(dataOf(rig.base));
    expect(back.layers.map((layer) => layer.images.map(dataAt))).toEqual(rig.layers.map((layer) => layer.images.map(dataOf)));
  });

  it('carries each distinct image once, however many layers draw it', () => {
    const card = build();
    expect(card.images).toHaveLength(5); // body, arm, hand, mouth, eyes
    expect(new Set(card.images).size).toBe(card.images.length);
  });

  it('carries bundled images in full, so the default rig travels without its assets', () => {
    const card = build(DEFAULT_MASCOT_RIG);
    expect(card.images).toContain(dataOf({ kind: 'bundled', name: 'arms-wave' }));
    expect(JSON.stringify(card.rig)).not.toContain('bundled');
  });

  it('stamps the marker, the card version and the app version', () => {
    expect(build()).toMatchObject({ formamorphKind: 'mascot', version: MASCOT_CARD_VERSION, appVersion: '3.0.1' });
  });

  it('round-trips the mascot name', () => {
    const card = parseMascotCardData(throughJson(build()));
    expect(card.name).toBe('Captain');
    expect(mascotCardName(card, 'friend.webp')).toBe('Captain');
  });

  it('names a card without a name after its file', () => {
    for (const name of [DELETE, '', '  ']) {
      const card = parseMascotCardData(edited('name', name));
      expect(card.name).toBeUndefined();
      expect(mascotCardName(card, 'Old Friend.webp')).toBe('Old Friend');
    }
  });

  it('keeps a pick at a missing layer, which the tab warns about', () => {
    expect(parseMascotCardData(throughJson(build())).rig.picks.thinking.expression).toBe('gone');
  });
});

describe('a refused mascot card', () => {
  it('refuses a value that is not a mascot card', () => {
    expect(() => parseMascotCardData('text')).toThrow("This image isn't a Formamorph mascot card.");
    expect(() => parseMascotCardData({ formamorphKind: 'entity', version: '3.0.1' })).toThrow("This image isn't a Formamorph mascot card.");
  });

  it('refuses an unknown version by its number', () => {
    expect(() => parseMascotCardData(edited('version', 2)))
      .toThrow(`This mascot card is version 2. This build reads version ${MASCOT_CARD_VERSION}.`);
  });

  it.each<[string, unknown]>([
    ['appVersion', DELETE],
    ['name', 5],
    ['images', 'none'],
    ['images.1', 'https://example.com/arm.png'],
    ['images.2', 'data:image/png;base64,not base64!'],
    ['images.0', 'data:text/html;base64,AAAA'],
    ['images.5', 'data:image/png;base64,AAAA'],
    ['rig', []],
    ['rig.base', 99],
    ['rig.layers', DELETE],
    ['rig.layers.1', null],
    ['rig.layers.1.id', 'wave'],
    ['rig.layers.0.id', ''],
    ['rig.layers.2.name', 7],
    ['rig.layers.0.kind', 'pose'],
    ['rig.layers.2.enabled', 'no'],
    ['rig.layers.1.images', {}],
    ['rig.layers.1.images.0', 1.5],
    ['rig.layers.0.images.1', -1],
    ['rig.mask', { x: 0, y: 0, width: 0, height: 10 }],
    ['rig.picks', DELETE],
    ['rig.picks.idle', DELETE],
    ['rig.picks.initial.state', ''],
    ['rig.picks.thinking.expression', 3],
    ['rig.voice', null],
    ['rig.transition', DELETE],
    ['rig.transition.mode', 'spin'],
    ['rig.transition.jelly.squash', 0.9],
    ['rig.transition.jelly.durationMs', '450'],
    ['rig.transition.jelly.settle', 1.5],
    ['rig.transition.dissolve', DELETE],
  ])('refuses a bad %s by name', (field, value) => {
    expect(() => parseMascotCardData(edited(field, value))).toThrow(refusal(field));
  });

  it('accepts a whole-base Mask', () => {
    expect(parseMascotCardData(edited('rig.mask', null)).rig.mask).toBeNull();
  });
});
