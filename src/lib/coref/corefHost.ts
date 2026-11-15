/**
 * The Coref Host's model-independent half: one passage in, clusters of character spans out. It ports the
 * fastcoref host code that ran in the Python evaluation (tokenization, top-k mention pruning, LingMess
 * category masks, antecedent argmax, cluster building) around two graph runs it is handed. The worker
 * supplies onnxruntime sessions; tests supply recorded outputs.
 */
import { createBpeEncoder, type TokenizerJson } from './bpe';
import { wordTokenize } from './wordTokenizer';

/** The graph contract this host runs (graph names, inputs, outputs, dtypes). A manifest's `minHostVersion`
 *  compares against it. */
export const COREF_GRAPH_CONTRACT = 1;

export type CorefArchitecture = 'lingmess' | 'fcoref';

/** Per-model head settings, from the model's host-config file. */
export interface CorefHostConfig {
  architecture: CorefArchitecture;
  topLambda: number;
  maxSpanLength: number;
  maxSegmentLen: number;
  /** Longer passages get no clusters, as fastcoref skips them. */
  maxDocLen?: number | null;
  graphContract: number;
}

export interface HostTensor {
  type: 'int64' | 'int32' | 'float32';
  data: BigInt64Array | Int32Array | Float32Array;
  dims: readonly number[];
}

export type GraphRun = (feeds: Record<string, HostTensor>) => Promise<Record<string, HostTensor>>;

/** Graph A (encoder and mention logits) and graph B (antecedent logits). */
export interface CorefGraphs {
  a: GraphRun;
  b: GraphRun;
}

/** `[start, end)` in the passage, UTF-16 code units. */
export type CharSpan = [number, number];
/** Spans of one entity, in the order the model linked them. */
export type CorefCluster = CharSpan[];

export interface CorefHost {
  resolve(text: string): Promise<CorefCluster[]>;
}

const PAD_ID = 1;

// fastcoref's consts: pronoun groups and the stopwords dropped before head comparison.
const PRONOUN_GROUPS: Record<string, number> = {
  i: 0, me: 0, my: 0, mine: 0, myself: 0,
  you: 1, your: 1, yours: 1, yourself: 1, yourselves: 1,
  he: 2, him: 2, his: 2, himself: 2,
  she: 3, her: 3, hers: 3, herself: 3,
  it: 4, its: 4, itself: 4,
  we: 5, us: 5, our: 5, ours: 5, ourselves: 5,
  they: 6, them: 6, their: 6, themselves: 6,
  that: 7, this: 7,
};
const STOPWORDS = new Set(["'s", 'a', 'all', 'an', 'and', 'at', 'for', 'from', 'in', 'into',
  'more', 'of', 'on', 'or', 'some', 'the', 'these', 'those']);
/** LingMess's six pair categories plus the all-pairs mask. */
const NUM_CATEGORIES = 7;

const int64 = (values: ArrayLike<number>, dims: number[]): HostTensor =>
  ({ type: 'int64', data: BigInt64Array.from(Array.from(values), (v) => BigInt(v)), dims });

interface Span {
  start: number;
  end: number;
}

/** fastcoref's `_prune_topk_mentions`: the k best spans by mention score, in (start, end) order. */
export function pruneTopK(
  logits: Float32Array, stride: number, seqLength: number, topLambda: number, maxSpanLength: number,
): { spans: Span[]; scores: Float32Array } {
  // torch: int64 length × float scalar runs in float32, then truncates.
  const k = Math.trunc(Math.fround(Math.fround(seqLength) * Math.fround(topLambda)));
  const candidates: number[] = [];
  for (let i = 0; i < seqLength; i++) {
    for (let j = i; j < Math.min(seqLength, i + maxSpanLength); j++) candidates.push(i * seqLength + j);
  }
  const score = (flat: number) => logits[Math.floor(flat / seqLength) * stride + (flat % seqLength)];
  candidates.sort((x, y) => score(y) - score(x) || x - y);
  const kept = candidates.slice(0, k).sort((x, y) => x - y);
  const spans = kept.map((flat) => ({ start: Math.floor(flat / seqLength), end: flat % seqLength }));
  return { spans, scores: Float32Array.from(kept, score) };
}

// fastcoref's get_category_id over (word set without stopwords, pronoun group).
function category(m: { words: Set<string>; pronoun: number }, a: { words: Set<string>; pronoun: number }): number {
  if (m.pronoun > -1 && a.pronoun > -1) return m.pronoun === a.pronoun ? 0 : 1;
  if (m.pronoun > -1 || a.pronoun > -1) return 2;
  const union = new Set([...m.words, ...a.words]);
  if (union.size === m.words.size && union.size === a.words.size) return 3;
  return union.size === Math.max(m.words.size, a.words.size) ? 4 : 5;
}

/** LingMess's category label for each (mention, earlier antecedent) pair, row-major; -1 for no pair. */
export function categoryLabels(spans: Span[], wordIds: number[], words: string[]): Int8Array {
  const info = spans.map(({ start, end }) => {
    const ids = new Set(wordIds.slice(start, end + 1).filter((w) => w >= 0));
    const lower = new Set([...ids].map((w) => words[w].toLowerCase()));
    const pronoun = lower.size === 1 ? (PRONOUN_GROUPS[[...lower][0]] ?? -1) : -1;
    return { words: new Set([...lower].filter((w) => !STOPWORDS.has(w))), pronoun };
  });
  const k = spans.length;
  const labels = new Int8Array(k * k).fill(-1);
  for (let i = 0; i < k; i++) for (let j = 0; j < i; j++) labels[i * k + j] = category(info[i], info[j]);
  return labels;
}

function categoryMasks(labels: Int8Array, k: number): HostTensor {
  const data = new Int32Array(NUM_CATEGORIES * k * k);
  for (let p = 0; p < k * k; p++) {
    const label = labels[p];
    if (label < 0) continue;
    data[label * k * k + p] = 1;
    data[(NUM_CATEGORIES - 1) * k * k + p] = 1;
  }
  return { type: 'int32', data, dims: [1, NUM_CATEGORIES, k, k] };
}

/** fastcoref's create_mention_to_antecedent + create_clusters over final logits [k, k + 1]. */
export function buildClusters(final: Float32Array, k: number, spans: Span[]): Span[][] {
  // Rows run in span order and antecedents come earlier, so a mention is never in a cluster before its row.
  const clusters: number[][] = [];
  const clusterOf = new Map<number, number>();
  for (let i = 0; i < k; i++) {
    let best = 0; // numpy argmax: the first maximum
    for (let j = 1; j <= k; j++) if (final[i * (k + 1) + j] > final[i * (k + 1) + best]) best = j;
    if (best === k) continue;
    const at = clusterOf.get(best);
    if (at !== undefined) {
      clusters[at].push(i);
      clusterOf.set(i, at);
    } else {
      clusterOf.set(i, clusters.length);
      clusterOf.set(best, clusters.length);
      clusters.push([best, i]);
    }
  }
  return clusters.map((c) => c.map((s) => spans[s]));
}

// Graph A's inputs: one sequence (LingMess) or padded segments of maxSegmentLen (FCoref).
function graphAFeeds(ids: number[], config: CorefHostConfig): Record<string, HostTensor> {
  const S = ids.length;
  if (config.architecture === 'lingmess') {
    return {
      input_ids: int64(ids, [1, S]),
      attention_mask: int64(new Array<number>(S).fill(1), [1, S]),
      position_ids: int64(ids.map((_, i) => i + 2), [1, S]),
    };
  }
  const seg = config.maxSegmentLen;
  const n = Math.ceil(S / seg);
  const real = (i: number) => i < S;
  const range = Array.from({ length: n * seg }, (_, i) => i);
  return {
    input_ids: int64(range.map((i) => (real(i) ? ids[i] : PAD_ID)), [n, seg]),
    attention_mask: int64(range.map((i) => (real(i) ? 1 : 0)), [n, seg]),
    position_ids: int64(range.map((i) => (real(i) ? (i % seg) + 2 : PAD_ID)), [n, seg]),
  };
}

/** A host for one model. `graphs` run that model's two graphs. */
export function createCorefHost(config: CorefHostConfig, tokenizer: TokenizerJson, graphs: CorefGraphs): CorefHost {
  if (config.graphContract !== COREF_GRAPH_CONTRACT) {
    throw new Error(`Coref graph contract ${config.graphContract} is not supported (host runs ${COREF_GRAPH_CONTRACT})`);
  }
  const encode = createBpeEncoder(tokenizer);
  return {
    async resolve(text) {
      const tokens = wordTokenize(text);
      const words = tokens.map((t) => t.text);
      const { ids, wordIds } = encode(words);
      const S = ids.length;
      if (config.maxDocLen && S > config.maxDocLen) return [];
      const outA = await graphs.a(graphAFeeds(ids, config));
      const mention = outA.mention_logits;
      const stride = mention.dims[mention.dims.length - 1];
      const { spans, scores } = pruneTopK(mention.data as Float32Array, stride, S, config.topLambda, config.maxSpanLength);
      const k = spans.length;
      if (k === 0) return [];
      const topk = new Float32Array(k * k);
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) topk[i * k + j] = Math.fround(scores[i] + scores[j]);
      const feedsB: Record<string, HostTensor> = {
        starts: int64(spans.map((s) => s.start), [1, k]),
        ends: int64(spans.map((s) => s.end), [1, k]),
        span_mask: { type: 'int32', data: new Int32Array(k).fill(1), dims: [1, k] },
        topk_mention_logits: { type: 'float32', data: topk, dims: [1, k, k] },
      };
      if (config.architecture === 'lingmess') {
        feedsB.sequence_output = outA.sequence_output;
        feedsB.categories_masks = categoryMasks(categoryLabels(spans, wordIds, words), k);
      } else {
        feedsB.start_reps = outA.start_reps;
        feedsB.end_reps = outA.end_reps;
      }
      const { final_logits: final } = await graphs.b(feedsB);
      return buildClusters(final.data as Float32Array, k, spans)
        .map((cluster) => cluster.flatMap(({ start, end }): CharSpan[] => {
          const ws = wordIds[start];
          const we = wordIds[end];
          return ws < 0 || we < 0 ? [] : [[tokens[ws].start, tokens[we].end]];
        }))
        .filter((cluster) => cluster.length > 0);
    },
  };
}
