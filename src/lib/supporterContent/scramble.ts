/**
 * The client half of scramble format version 1: rebuilds a Supporter content layer the server scrambled.
 *
 * The server pads each layer with transparent pixels to a multiple of 8 per axis, cuts an 8×8 grid, and moves
 * the tiles by a Sattolo permutation over mulberry32. Scrambled tile `i` holds source tile `permutation[i]`.
 * Both repos test against the same vectors (`scrambleVectors.json`).
 */

export const SCRAMBLE_VERSION = 1;
const GRID = 8;
const TILES = GRID * GRID;
const BYTES = 4;

/** One image as the gated route returns it, in place of its data-URL string. */
export interface ScrambledLayer {
  dataUrl: string;
  seed: number;
  version: number;
  sourceWidth: number;
  sourceHeight: number;
}

/** What a scrambled image needs besides its pixels to be put back. */
export type UnscrambleParams = Omit<ScrambledLayer, 'dataUrl'>;

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/** One tile copy: the rectangle at `from` in the scrambled image goes to `to` in the source image. */
export interface TileMove {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  width: number;
  height: number;
}

const isSize = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

export function isScrambledLayer(value: unknown): value is ScrambledLayer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const layer = value as Record<string, unknown>;
  return typeof layer.dataUrl === 'string'
    && Number.isInteger(layer.seed)
    && Number.isInteger(layer.version)
    && isSize(layer.sourceWidth)
    && isSize(layer.sourceHeight);
}

const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const permutationFor = (seed: number): number[] => {
  const next = mulberry32(seed);
  const order = Array.from({ length: TILES }, (_, i) => i);
  for (let i = TILES - 1; i > 0; i--) {
    const j = Math.floor(next() * i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
};

const paddedSize = (size: number) => Math.ceil(size / GRID) * GRID;

/**
 * The tile copies that rebuild the padded source from a scrambled image.
 *
 * @throws RangeError on an unknown version or a seed outside 32 bits
 */
export function tileMoves({ seed, version, sourceWidth, sourceHeight }: UnscrambleParams): TileMove[] {
  if (version !== SCRAMBLE_VERSION) throw new RangeError(`Unknown scramble version ${version}`);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('The seed must be a 32-bit unsigned integer');
  if (!isSize(sourceWidth) || !isSize(sourceHeight)) throw new RangeError('The source size must be positive integers');
  const width = paddedSize(sourceWidth) / GRID;
  const height = paddedSize(sourceHeight) / GRID;
  return permutationFor(seed).map((source, i) => ({
    fromX: (i % GRID) * width,
    fromY: Math.floor(i / GRID) * height,
    toX: (source % GRID) * width,
    toY: Math.floor(source / GRID) * height,
    width,
    height,
  }));
}

/**
 * Rebuild the source pixels of a scrambled RGBA image, cropped back to the source size.
 *
 * @throws RangeError when the image is not the padded size the params describe
 */
export function unscramble(image: RgbaImage, params: UnscrambleParams): RgbaImage {
  const moves = tileMoves(params);
  const width = paddedSize(params.sourceWidth);
  const height = paddedSize(params.sourceHeight);
  if (image.width !== width || image.height !== height || image.data.length !== width * height * BYTES) {
    throw new RangeError(`The scrambled image is ${image.width}×${image.height}, not ${width}×${height}`);
  }
  const padded = new Uint8ClampedArray(image.data.length);
  for (const move of moves) {
    const rowBytes = move.width * BYTES;
    for (let row = 0; row < move.height; row++) {
      const from = ((move.fromY + row) * width + move.fromX) * BYTES;
      padded.set(image.data.subarray(from, from + rowBytes), ((move.toY + row) * width + move.toX) * BYTES);
    }
  }
  const out = new Uint8ClampedArray(params.sourceWidth * params.sourceHeight * BYTES);
  const outRow = params.sourceWidth * BYTES;
  for (let y = 0; y < params.sourceHeight; y++) out.set(padded.subarray(y * width * BYTES, y * width * BYTES + outRow), y * outRow);
  return { width: params.sourceWidth, height: params.sourceHeight, data: out };
}

const decode = async (dataUrl: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return image;
};

/**
 * Rebuild a layer onto a new in-memory canvas at its source size, for drawing only.
 *
 * Tile copies with smoothing off move pixels exactly, and nothing reads them back, so the rebuilt layer
 * never becomes a stored record, a data URL or a Blob.
 *
 * @throws RangeError when the decoded image is not the padded size the layer describes
 */
export async function unscrambleToCanvas(
  layer: ScrambledLayer,
  load: (dataUrl: string) => Promise<CanvasImageSource & { width: number; height: number }> = decode,
): Promise<HTMLCanvasElement> {
  const moves = tileMoves(layer);
  const image = await load(layer.dataUrl);
  const width = paddedSize(layer.sourceWidth);
  const height = paddedSize(layer.sourceHeight);
  if (image.width !== width || image.height !== height) {
    throw new RangeError(`The scrambled image is ${image.width}×${image.height}, not ${width}×${height}`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = layer.sourceWidth;
  canvas.height = layer.sourceHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D canvas context is available');
  context.imageSmoothingEnabled = false;
  for (const move of moves) {
    context.drawImage(image, move.fromX, move.fromY, move.width, move.height, move.toX, move.toY, move.width, move.height);
  }
  return canvas;
}
