/**
 * The coref model manifest (format 1, `testing/coref/README.md`): which weights exist for each model, where
 * they live, and how to check them.
 */
import { COREF_GRAPH_CONTRACT, type CorefHostConfig } from './corefHost';

export type CorefModelId = 'big' | 'small';

export const COREF_FILE_KEYS = ['graph_a', 'graph_b', 'tokenizer', 'hostConfig'] as const;
export type CorefFileKey = (typeof COREF_FILE_KEYS)[number];

export interface CorefManifestFile {
  url: string;
  /** Bytes. */
  size: number;
  /** Hex SHA-256 of the file. */
  sha256: string;
}

/** One published version of one model. */
export interface CorefManifestEntry {
  model: CorefModelId;
  version: number;
  architecture: CorefHostConfig['architecture'];
  minHostVersion: number;
  files: Record<CorefFileKey, CorefManifestFile>;
}

export type CorefManifest = Partial<Record<CorefModelId, CorefManifestEntry>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function parseFile(raw: unknown, base: string): CorefManifestFile | null {
  if (!isRecord(raw)) return null;
  const { url, size, sha256 } = raw;
  if (typeof url !== 'string' || typeof size !== 'number' || size < 0 || typeof sha256 !== 'string') return null;
  if (!/^[0-9a-f]{64}$/i.test(sha256)) return null;
  return { url: new URL(url, base).href, size, sha256: sha256.toLowerCase() };
}

function parseEntry(model: CorefModelId, raw: unknown, base: string): CorefManifestEntry | null {
  if (!isRecord(raw) || !isRecord(raw.files)) return null;
  const { version, architecture, minHostVersion } = raw;
  if (typeof version !== 'number' || typeof minHostVersion !== 'number') return null;
  if (architecture !== 'lingmess' && architecture !== 'fcoref') return null;
  const files = {} as Record<CorefFileKey, CorefManifestFile>;
  for (const key of COREF_FILE_KEYS) {
    const file = parseFile(raw.files[key], base);
    if (!file) return null;
    files[key] = file;
  }
  return { model, version, architecture, minHostVersion, files };
}

/** The manifest's models this host can run. A malformed model, or one needing a newer graph contract, is left
 *  out. File URLs resolve against `base`, the manifest's own URL. */
export function parseCorefManifest(raw: unknown, base: string): CorefManifest {
  if (!isRecord(raw) || raw.format !== 1 || !isRecord(raw.models)) throw new Error('The model list is not in a known format');
  const manifest: CorefManifest = {};
  for (const model of ['big', 'small'] as const) {
    const entry = parseEntry(model, raw.models[model], base);
    if (entry && entry.minHostVersion <= COREF_GRAPH_CONTRACT) manifest[model] = entry;
  }
  return manifest;
}

/** A model's download size in bytes. */
export const entrySize = (entry: CorefManifestEntry): number =>
  COREF_FILE_KEYS.reduce((sum, key) => sum + entry.files[key].size, 0);

/** The host config from a model's `host-config.json`, which the training kit writes in snake case. */
export function parseHostConfig(raw: unknown): CorefHostConfig {
  if (!isRecord(raw)) throw new Error('The model settings file is malformed');
  const pick = (snake: string, camel: string): unknown => raw[snake] ?? raw[camel];
  const architecture = pick('architecture', 'architecture');
  const topLambda = pick('top_lambda', 'topLambda');
  const maxSpanLength = pick('max_span_length', 'maxSpanLength');
  const maxSegmentLen = pick('max_segment_len', 'maxSegmentLen');
  const maxDocLen = pick('max_doc_len', 'maxDocLen');
  const graphContract = pick('graphContract', 'graphContract');
  if ((architecture !== 'lingmess' && architecture !== 'fcoref') || typeof topLambda !== 'number'
    || typeof maxSpanLength !== 'number' || typeof maxSegmentLen !== 'number' || typeof graphContract !== 'number') {
    throw new Error('The model settings file is malformed');
  }
  if (graphContract > COREF_GRAPH_CONTRACT) throw new Error('This model needs a newer version of Formamorph');
  return {
    architecture, topLambda, maxSpanLength, maxSegmentLen, graphContract,
    ...(typeof maxDocLen === 'number' ? { maxDocLen } : {}),
  };
}
