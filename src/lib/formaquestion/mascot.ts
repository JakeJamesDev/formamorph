/**
 * The Formaquestion Mascot as data: the rig, its codec, the composition that decides what draws, and the
 * pick warnings. No other module reads a layer's kind; the renderer draws the composition's list as given.
 */
import { isRecord } from '@/lib/tools/toolValidation';
import { DEFAULT_MASCOT_TRANSITION, parseMascotTransition, type MascotTransition } from './mascotTransition';

/** The default rig's images, bundled under `mascotAssets/`. Cut from the author's layered file by `scripts/cutMascotRig.mjs`. */
export const MASCOT_ASSET_NAMES = [
  'base', 'blush', 'right-closed', 'left-closed',
  'eyebrows-raised', 'eyebrows-furrowed',
  'eyes-heart', 'eyes-lidded', 'eyes-crying', 'eyes-tiny', 'eyes-wide', 'eyes-shocked', 'eyes-closed',
  'eyes-looking-up', 'eyes-dizzy', 'eyes-blank',
  'arms-thinking', 'arms-no-thinking', 'arms-wave', 'arms-no-wave',
  'mouth-wiggly', 'mouth-cat', 'mouth-grin', 'mouth-open', 'mouth-small-o', 'mouth-frown',
] as const;

export type MascotAssetName = (typeof MASCOT_ASSET_NAMES)[number];

/** An image of the rig: a bundled asset of the default rig, or a player image by its id in the mascot image store. */
export type MascotImageRef =
  | { readonly kind: 'bundled'; readonly name: MascotAssetName }
  | { readonly kind: 'stored'; readonly id: string };

/** An expression is the AI's to pick, one at a time; a state stacks with others and belongs to the player and the app. */
export const MASCOT_LAYER_KINDS = ['expression', 'state'] as const;
export type MascotLayerKind = (typeof MASCOT_LAYER_KINDS)[number];

/** One row of the rig. Its images draw in order over the base, stretched to the base size. */
export interface MascotLayer {
  readonly id: string;
  readonly name: string;
  readonly kind: MascotLayerKind;
  /** A disabled layer never draws, and the AI cannot pick it. */
  readonly enabled: boolean;
  readonly images: readonly MascotImageRef[];
}

/** The look of one app moment: a layer id for its expression and one for its state, either of which may be empty. */
export interface MascotPick {
  readonly expression: string | null;
  readonly state: string | null;
}

export const MASCOT_PICK_NAMES = ['initial', 'idle', 'thinking'] as const;
export type MascotPickName = (typeof MASCOT_PICK_NAMES)[number];

/** The head-only view: a crop of the base, in base pixels. */
export interface MascotMask {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MascotRig {
  readonly base: MascotImageRef;
  /** One ordered list for both kinds. List order is draw order. */
  readonly layers: readonly MascotLayer[];
  /** Null is the whole base. */
  readonly mask: MascotMask | null;
  readonly picks: { readonly [K in MascotPickName]: MascotPick };
  /** The Voice chip's text: how the help answers sound while the mascot is on. */
  readonly voice: string;
  /** How the mascot moves on a change of look. */
  readonly transition: MascotTransition;
}

/** The window's moment: the first look of an app load, a question in flight, or an answer on screen. */
export type MascotPhase = 'initial' | 'thinking' | 'answering';

const bundled = (name: MascotAssetName): MascotImageRef => ({ kind: 'bundled', name });

const defaultLayer = (id: string, name: string, kind: MascotLayerKind, images: readonly MascotAssetName[]): MascotLayer =>
  ({ id, name, kind, enabled: true, images: images.map(bundled) });

const NO_PICK: MascotPick = { expression: null, state: null };

/** The rig a player starts with, and the fallback for a stored rig that cannot be read. */
export const DEFAULT_MASCOT_RIG: MascotRig = {
  base: bundled('base'),
  // Each face stacks its overlays in the order the layered file does: mouth, eyes, winks, blush, eyebrows.
  // The AI and the player see the names; the ids stay stable for picks and saved rigs.
  layers: [
    defaultLayer('wave', 'Wave', 'state', ['arms-wave', 'arms-no-thinking']),
    defaultLayer('rest', 'Rest', 'state', ['arms-no-wave', 'arms-no-thinking']),
    defaultLayer('thinking', 'Thinking', 'state', ['arms-no-wave', 'arms-thinking']),
    defaultLayer('happy', 'Happy', 'expression', ['mouth-grin', 'eyes-closed']),
    defaultLayer('excited', 'Blushing', 'expression', ['mouth-grin', 'eyes-closed', 'blush']),
    defaultLayer('surprised', 'Surprised', 'expression', ['mouth-open', 'eyes-shocked']),
    defaultLayer('pondering', 'Pondering', 'expression', ['eyes-looking-up', 'mouth-small-o']),
    defaultLayer('confused', 'Confused', 'expression', ['mouth-small-o', 'eyebrows-raised']),
    defaultLayer('sad', 'Crying', 'expression', ['mouth-wiggly', 'eyes-crying', 'eyebrows-furrowed']),
    defaultLayer('smitten', 'Smitten', 'expression', ['mouth-grin', 'eyes-heart']),
    defaultLayer('dizzy', 'Dizzy', 'expression', ['mouth-wiggly', 'eyes-dizzy']),
    defaultLayer('wink', 'Wink', 'expression', ['mouth-grin', 'right-closed']),
    defaultLayer('flustered', 'Slighted', 'expression', ['mouth-cat', 'eyes-lidded', 'left-closed', 'eyebrows-furrowed']),
    defaultLayer('unimpressed', 'Unimpressed', 'expression', ['mouth-frown', 'eyes-lidded', 'eyebrows-raised']),
  ],
  mask: { x: 100, y: 0, width: 768, height: 680 },
  picks: {
    initial: { expression: null, state: 'wave' },
    idle: { expression: null, state: 'rest' },
    thinking: { expression: 'pondering', state: 'thinking' },
  },
  voice: 'Playful and cheerful, with a light touch of humor. Keep the fun in your word choice.',
  transition: DEFAULT_MASCOT_TRANSITION,
};

/**
 * The images to draw, bottom first: the base, then each active layer's images in list order. Initial and
 * thinking draw their pick's two layers. Answering draws the AI's expression when one is set, else the Idle
 * expression, plus the Idle state. A disabled layer is never active.
 */
export function composeMascot(rig: MascotRig, phase: MascotPhase, aiExpression: string | null): readonly MascotImageRef[] {
  const pick = rig.picks[phase === 'answering' ? 'idle' : phase];
  const expression = phase === 'answering' && aiExpression !== null ? aiExpression : pick.expression;
  const active = new Set([expression, pick.state]);
  return [rig.base, ...rig.layers.filter((row) => row.enabled && active.has(row.id)).flatMap((row) => row.images)];
}

export interface MascotPickWarning {
  readonly pick: MascotPickName;
  readonly slot: keyof MascotPick;
  readonly layerId: string;
  readonly problem: 'disabled' | 'missing';
}

const PICK_SLOTS: readonly (keyof MascotPick)[] = ['expression', 'state'];

/** Each pick slot that names a disabled layer or a layer the rig does not have. */
export function mascotPickWarnings(rig: MascotRig): readonly MascotPickWarning[] {
  const byId = new Map(rig.layers.map((row) => [row.id, row]));
  return MASCOT_PICK_NAMES.flatMap((pick) => PICK_SLOTS.flatMap((slot): MascotPickWarning[] => {
    const layerId = rig.picks[pick][slot];
    if (layerId === null) return [];
    const row = byId.get(layerId);
    if (!row) return [{ pick, slot, layerId, problem: 'missing' }];
    return row.enabled ? [] : [{ pick, slot, layerId, problem: 'disabled' }];
  }));
}

/** A non-empty string, as every rig id is. */
export const isId = (value: unknown): value is string => typeof value === 'string' && value !== '';
export const isLayerKind = (value: unknown): value is MascotLayerKind => (MASCOT_LAYER_KINDS as readonly unknown[]).includes(value);
const isAssetName = (value: unknown): value is MascotAssetName => (MASCOT_ASSET_NAMES as readonly unknown[]).includes(value);

function parseImageRef(stored: unknown): MascotImageRef | null {
  if (!isRecord(stored)) return null;
  if (stored.kind === 'bundled' && isAssetName(stored.name)) return bundled(stored.name);
  if (stored.kind === 'stored' && isId(stored.id)) return { kind: 'stored', id: stored.id };
  return null;
}

function parseLayer(stored: unknown): MascotLayer | null {
  if (!isRecord(stored) || !Array.isArray(stored.images)) return null;
  const { id, name, kind, enabled } = stored;
  if (!isId(id) || typeof name !== 'string' || !isLayerKind(kind) || typeof enabled !== 'boolean') return null;
  const images = stored.images.map(parseImageRef).filter((image): image is MascotImageRef => image !== null);
  return images.length === stored.images.length ? { id, name, kind, enabled, images } : null;
}

/** Good layers in order; a bad layer and a repeated id drop. */
function parseLayers(stored: unknown[]): MascotLayer[] {
  const seen = new Set<string>();
  return stored.flatMap((entry) => {
    const row = parseLayer(entry);
    if (!row || seen.has(row.id)) return [];
    seen.add(row.id);
    return [row];
  });
}

const isSlot = (value: unknown): value is string | null => value === null || isId(value);

function parsePick(stored: unknown): MascotPick {
  if (!isRecord(stored) || !isSlot(stored.expression) || !isSlot(stored.state)) return NO_PICK;
  return { expression: stored.expression, state: stored.state };
}

const isSize = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isOffset = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** A stored Mask, or null for a value that is not one. */
export function parseMask(stored: unknown): MascotMask | null {
  if (!isRecord(stored)) return null;
  const { x, y, width, height } = stored;
  return isOffset(x) && isOffset(y) && isSize(width) && isSize(height) ? { x, y, width, height } : null;
}

/**
 * A stored rig, read field by field. A bad layer drops and the others stay; a bad or missing pick clears; a
 * bad Mask reads as the whole base; any other bad or missing field takes the default rig's. A value that is
 * not an object reads as the default rig.
 */
export function parseMascotRig(stored: unknown): MascotRig {
  if (!isRecord(stored)) return DEFAULT_MASCOT_RIG;
  const picks = isRecord(stored.picks) ? stored.picks : {};
  return {
    base: parseImageRef(stored.base) ?? DEFAULT_MASCOT_RIG.base,
    layers: Array.isArray(stored.layers) ? parseLayers(stored.layers) : DEFAULT_MASCOT_RIG.layers,
    mask: parseMask(stored.mask),
    picks: { initial: parsePick(picks.initial), idle: parsePick(picks.idle), thinking: parsePick(picks.thinking) },
    voice: typeof stored.voice === 'string' ? stored.voice : DEFAULT_MASCOT_RIG.voice,
    transition: parseMascotTransition(stored.transition),
  };
}
