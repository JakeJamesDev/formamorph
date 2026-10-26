/**
 * The shipped form of a bundled world: its lossless source file with Downscale applied. Node only; the build
 * plugin `scripts/shipBundledWorlds.mjs` bundles it.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { World } from '@/types';
import { downscaleDeps, reencodeWorldSlots, type DownscaleDeps, type ImageCodec } from './imageOptimCore';
import { worldImageItems } from './mediaIndex';
import { isAnimatedWebpUrl, nodeImageCodec } from './nodeImageCodec';

/** Downscale's selection, minus animated images, which ship unchanged. */
function shipDeps(codec: ImageCodec): DownscaleDeps {
  const deps = downscaleDeps(codec);
  return { ...deps, shouldEncode: async (url, cap) => !isAnimatedWebpUrl(url) && deps.shouldEncode(url, cap) };
}

/**
 * Apply Downscale to a world file's text. Only the image slots Downscale selects change, and an animated image
 * never does. A world with none comes back as the same text.
 *
 * @param source - A bundled world file's text
 * @param codec - The codec that measures and encodes each image
 */
export async function downscaleWorldText(source: string, codec: ImageCodec): Promise<string> {
  const world = JSON.parse(source) as World;
  const out = await reencodeWorldSlots(world, shipDeps(codec));
  return out === world ? source : `${JSON.stringify(out, null, 2)}\n`;
}

/**
 * The animated images over their budget that ship unchanged, each named "<parent> › <slot>".
 *
 * @param source - A bundled world file's text
 */
export async function skippedAnimations(source: string): Promise<string[]> {
  const deps = downscaleDeps(nodeImageCodec);
  const names: string[] = [];
  for (const item of worldImageItems(JSON.parse(source) as World)) {
    if (isAnimatedWebpUrl(item.value) && (await deps.shouldEncode(item.value, item.budget))) {
      names.push(`${item.parent.name} › ${item.slot}`);
    }
  }
  return names;
}

const SRC = fileURLToPath(new URL('../', import.meta.url));
const NODE_MODULES = path.join(SRC, '../node_modules');
const CACHE_DIR = path.join(NODE_MODULES, '.cache/formamorph-shipped-worlds');
/** The packages that decode and encode the shipped images. */
const CODEC_PACKAGES = ['wasm-webp', 'sharp'];

/** A static value import's module path; `import type` lines are skipped. */
const VALUE_IMPORT = /^import\s+(?!type\b)[^'"]*?\sfrom\s+['"]([^'"]+)['"]/gm;

/** The project files this module runs, found by following its static imports. */
function importGraph(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(VALUE_IMPORT)) {
    const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
    const resolved = base && ['', '.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((p) => existsSync(p) && statSync(p).isFile());
    if (resolved) importGraph(resolved, seen);
  }
  return seen;
}

let ruleHash: string | null = null;

/** Everything that decides the shipped bytes: this module's import graph and the codec packages' manifests. */
export const shipRuleFiles = (): string[] => [
  ...[...importGraph(fileURLToPath(import.meta.url))].sort(),
  ...CODEC_PACKAGES.map((name) => path.join(NODE_MODULES, name, 'package.json')),
];

function shipRuleHash(): string {
  if (ruleHash) return ruleHash;
  const hash = createHash('sha256');
  for (const file of shipRuleFiles()) hash.update(path.relative(SRC, file)).update(readFileSync(file));
  return (ruleHash = hash.digest('hex'));
}

/**
 * The shipped text of a bundled world file, through the Node codec. Results are cached by the source text and
 * the ship rule's own code, so the build, the tests and `npm run fingerprints` encode each world once.
 *
 * @param source - A bundled world file's text
 */
export async function shippedWorldText(source: string): Promise<string> {
  const key = createHash('sha256').update(shipRuleHash()).update(source).digest('hex');
  const file = path.join(CACHE_DIR, `${key}.json`);
  try {
    return readFileSync(file, 'utf8');
  } catch {
    // Not cached yet.
  }
  const shipped = await downscaleWorldText(source, nodeImageCodec);
  mkdirSync(CACHE_DIR, { recursive: true });
  // A rename is atomic, so a parallel reader never sees half a file.
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, shipped);
  renameSync(temp, file);
  return shipped;
}
