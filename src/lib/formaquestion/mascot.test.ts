import { describe, expect, it } from 'vitest';
import {
  composeMascot, DEFAULT_MASCOT_RIG, MASCOT_ASSET_NAMES, mascotPickWarnings, parseMascotRig,
  type MascotImageRef, type MascotLayer, type MascotLayerKind, type MascotRig,
} from './mascot';
import { bundledMascotFiles, mascotAssetUrl } from './mascotAssets';

const img = (id: string): MascotImageRef => ({ kind: 'stored', id });

const row = (id: string, kind: MascotLayerKind, images: string[], enabled = true): MascotLayer =>
  ({ id, name: id.toUpperCase(), kind, enabled, images: images.map(img) });

/** A small rig: two expressions round a state, so list order is visible across kinds. */
const rig = (change: Partial<MascotRig> = {}): MascotRig => ({
  base: img('base'),
  layers: [
    row('smile', 'expression', ['smile-mouth']),
    row('wave', 'state', ['wave-arm', 'still-arm']),
    row('rest', 'state', ['rest-arm']),
    row('think', 'expression', ['up-eyes', 'o-mouth']),
    row('sad', 'expression', ['sad-eyes']),
    row('point', 'state', ['point-arm']),
  ],
  mask: null,
  picks: {
    initial: { expression: 'smile', state: 'wave' },
    idle: { expression: 'smile', state: 'rest' },
    thinking: { expression: 'think', state: 'point' },
  },
  voice: 'Cheerful.',
  transition: { mode: 'dissolve', jelly: { durationMs: 600, squash: 0.3, overshoot: 0.2, settle: 1 }, dissolve: { durationMs: 400 } },
  ...change,
});

const ids = (images: readonly MascotImageRef[]): string[] => images.map((image) => (image.kind === 'stored' ? image.id : image.name));

const disable = (target: MascotRig, layerId: string): MascotRig =>
  ({ ...target, layers: target.layers.map((layer) => (layer.id === layerId ? { ...layer, enabled: false } : layer)) });

describe('composeMascot', () => {
  it('draws the Initial pick over the base, in list order', () => {
    expect(ids(composeMascot(rig(), 'initial', null))).toEqual(['base', 'smile-mouth', 'wave-arm', 'still-arm']);
  });

  it('draws the Thinking pick in list order, not pick order', () => {
    expect(ids(composeMascot(rig(), 'thinking', null))).toEqual(['base', 'up-eyes', 'o-mouth', 'point-arm']);
  });

  it('draws the Idle pick while answering with no AI expression', () => {
    expect(ids(composeMascot(rig(), 'answering', null))).toEqual(['base', 'smile-mouth', 'rest-arm']);
  });

  it("swaps the Idle expression for the AI's and keeps the Idle state", () => {
    expect(ids(composeMascot(rig(), 'answering', 'sad'))).toEqual(['base', 'rest-arm', 'sad-eyes']);
  });

  it("ignores the AI's expression before the answer", () => {
    expect(ids(composeMascot(rig(), 'thinking', 'sad'))).toEqual(['base', 'up-eyes', 'o-mouth', 'point-arm']);
    expect(ids(composeMascot(rig(), 'initial', 'sad'))).toEqual(['base', 'smile-mouth', 'wave-arm', 'still-arm']);
  });

  it('draws nothing for a disabled layer, picked or set by the AI', () => {
    expect(ids(composeMascot(disable(rig(), 'wave'), 'initial', null))).toEqual(['base', 'smile-mouth']);
    expect(ids(composeMascot(disable(rig(), 'sad'), 'answering', 'sad'))).toEqual(['base', 'rest-arm']);
  });

  it('draws the base alone for an empty pick', () => {
    const empty = rig({ picks: { ...rig().picks, idle: { expression: null, state: null } } });
    expect(ids(composeMascot(empty, 'answering', null))).toEqual(['base']);
  });

  it('draws nothing for a pick that names a missing layer', () => {
    const stale = rig({ picks: { ...rig().picks, initial: { expression: 'gone', state: 'wave' } } });
    expect(ids(composeMascot(stale, 'initial', null))).toEqual(['base', 'wave-arm', 'still-arm']);
  });
});

describe('the default rig', () => {
  const names = (images: readonly MascotImageRef[]): string[] => images.map((image) => (image.kind === 'bundled' ? image.name : `stored:${image.id}`));

  it('waves at first, rests when idle, and looks up with a hand at the chin while thinking', () => {
    expect(names(composeMascot(DEFAULT_MASCOT_RIG, 'initial', null))).toEqual(['base', 'arms-wave', 'arms-no-thinking']);
    expect(names(composeMascot(DEFAULT_MASCOT_RIG, 'answering', null))).toEqual(['base', 'arms-no-wave', 'arms-no-thinking']);
    expect(names(composeMascot(DEFAULT_MASCOT_RIG, 'thinking', null)))
      .toEqual(['base', 'mouth-open', 'arms-no-wave', 'arms-thinking', 'eyes-looking-up']);
  });

  it('lists its three states, then twelve whole faces with word names', () => {
    expect(DEFAULT_MASCOT_RIG.layers.map((layer) => `${layer.kind}:${layer.name}`)).toEqual([
      'state:Wave', 'state:Rest', 'state:Thinking',
      ...['Happy', 'Excited', 'Surprised', 'Pondering', 'Confused', 'Sad', 'Sleepy', 'Smitten', 'Dizzy', 'Wink', 'Flustered', 'Unimpressed']
        .map((name) => `expression:${name}`),
    ]);
  });

  it("draws a face's mouth under its eyes, and its eyebrows on top", () => {
    expect(names(composeMascot(DEFAULT_MASCOT_RIG, 'answering', 'surprised')))
      .toEqual(['base', 'arms-no-wave', 'arms-no-thinking', 'mouth-open', 'eyes-shocked', 'eyebrows-raised']);
  });

  it('has no pick warnings and reads back as itself', () => {
    expect(mascotPickWarnings(DEFAULT_MASCOT_RIG)).toEqual([]);
    expect(parseMascotRig(JSON.parse(JSON.stringify(DEFAULT_MASCOT_RIG)))).toEqual(DEFAULT_MASCOT_RIG);
  });

  it('names only bundled images, and every asset name has its file', () => {
    const used = [DEFAULT_MASCOT_RIG.base, ...DEFAULT_MASCOT_RIG.layers.flatMap((layer) => layer.images)];
    expect(used.every((image) => image.kind === 'bundled')).toBe(true);
    expect([...bundledMascotFiles()].sort()).toEqual([...MASCOT_ASSET_NAMES].sort());
    for (const name of MASCOT_ASSET_NAMES) expect(mascotAssetUrl(name)).toMatch(/\.webp/);
  });
});

describe('mascotPickWarnings', () => {
  it('names each pick slot that points at a disabled or missing layer', () => {
    const stale = disable(rig({ picks: { ...rig().picks, idle: { expression: 'gone', state: 'rest' } } }), 'point');
    expect(mascotPickWarnings(stale)).toEqual([
      { pick: 'idle', slot: 'expression', layerId: 'gone', problem: 'missing' },
      { pick: 'thinking', slot: 'state', layerId: 'point', problem: 'disabled' },
    ]);
  });

  it('names a layer once per pick that points at it', () => {
    expect(mascotPickWarnings(disable(rig(), 'smile')).map((warning) => warning.pick)).toEqual(['initial', 'idle']);
  });

  it('passes empty slots and enabled layers', () => {
    expect(mascotPickWarnings(rig({ picks: { ...rig().picks, initial: { expression: null, state: null } } }))).toEqual([]);
  });
});

describe('parseMascotRig', () => {
  const stored = (): Record<string, unknown> => JSON.parse(JSON.stringify(rig())) as Record<string, unknown>;

  it('keeps a good rig', () => {
    const good = rig({ mask: { x: 10, y: 0, width: 300, height: 280 } });
    expect(parseMascotRig(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it.each([
    ['no id', { name: 'X', kind: 'state', enabled: true, images: [] }],
    ['an empty id', { id: '', name: 'X', kind: 'state', enabled: true, images: [] }],
    ['an unknown kind', { id: 'x', name: 'X', kind: 'pose', enabled: true, images: [] }],
    ['a non-boolean switch', { id: 'x', name: 'X', kind: 'state', enabled: 'yes', images: [] }],
    ['no images list', { id: 'x', name: 'X', kind: 'state', enabled: true }],
    ['a bad image', { id: 'x', name: 'X', kind: 'state', enabled: true, images: [{ kind: 'stored', id: 'ok' }, { kind: 'bundled', name: 'nope' }] }],
    ['the id of an earlier layer', { id: 'wave', name: 'Again', kind: 'state', enabled: true, images: [] }],
    ['a value that is not an object', 'wave'],
  ])('drops a layer with %s and keeps the others', (_, bad) => {
    const value = stored();
    const layers = value.layers as unknown[];
    value.layers = [...layers.slice(0, 2), bad, ...layers.slice(2)];
    expect(parseMascotRig(value).layers).toEqual(rig().layers);
  });

  it('keeps an empty layer list', () => {
    expect(parseMascotRig({ ...stored(), layers: [] }).layers).toEqual([]);
  });

  it.each([
    ['a number slot', { expression: 4, state: 'rest' }],
    ['an empty-string slot', { expression: 'smile', state: '' }],
    ['a missing slot', { expression: 'smile' }],
    ['a value that is not an object', 'smile'],
  ])('clears a pick with %s and keeps the others', (_, bad) => {
    const parsed = parseMascotRig({ ...stored(), picks: { ...rig().picks, idle: bad } });
    expect(parsed.picks).toEqual({ ...rig().picks, idle: { expression: null, state: null } });
  });

  it('keeps a pick that names a missing layer, for the warning', () => {
    const picks = { ...rig().picks, idle: { expression: 'gone', state: null } };
    expect(parseMascotRig({ ...stored(), picks }).picks.idle).toEqual({ expression: 'gone', state: null });
  });

  it.each([
    ['missing', undefined],
    ['a zero width', { x: 0, y: 0, width: 0, height: 10 }],
    ['a negative offset', { x: -1, y: 0, width: 10, height: 10 }],
    ['a text field', { x: 0, y: '0', width: 10, height: 10 }],
    ['an infinite size', { x: 0, y: 0, width: Infinity, height: 10 }],
  ])('reads a Mask that is %s as the whole base', (_, mask) => {
    expect(parseMascotRig({ ...stored(), mask }).mask).toBeNull();
  });

  it.each([null, undefined, 'rig', 42, ['layers']])('reads %j as the default rig', (value) => {
    expect(parseMascotRig(value)).toBe(DEFAULT_MASCOT_RIG);
  });

  it("takes the default rig's base, layers, voice and transition for missing or bad fields", () => {
    const parsed = parseMascotRig({ base: { kind: 'bundled', name: 'nope' }, layers: 'many', voice: 7 });
    expect(parsed.base).toEqual(DEFAULT_MASCOT_RIG.base);
    expect(parsed.layers).toEqual(DEFAULT_MASCOT_RIG.layers);
    expect(parsed.voice).toBe(DEFAULT_MASCOT_RIG.voice);
    expect(parsed.transition).toEqual(DEFAULT_MASCOT_RIG.transition);
  });

  it.each([['missing', undefined], ['bad', 'all']])('clears every pick when the picks are %s', (_, picks) => {
    const empty = { expression: null, state: null };
    expect(parseMascotRig({ ...stored(), picks }).picks).toEqual({ initial: empty, idle: empty, thinking: empty });
  });

  it('reads a rig with no transition, or a bare mode, as the default transition', () => {
    const { transition: _, ...before } = stored();
    expect(parseMascotRig(before)).toEqual({ ...rig(), transition: DEFAULT_MASCOT_RIG.transition });
    expect(parseMascotRig({ ...before, transition: { mode: 'none' } }).transition).toEqual(DEFAULT_MASCOT_RIG.transition);
  });

  it("keeps a stored base and an empty voice", () => {
    const parsed = parseMascotRig({ ...stored(), base: { kind: 'stored', id: 'mine' }, voice: '' });
    expect(parsed.base).toEqual({ kind: 'stored', id: 'mine' });
    expect(parsed.voice).toBe('');
  });
});
