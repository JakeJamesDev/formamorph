import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TokenizerJson } from './bpe';
import {
  buildClusters, COREF_GRAPH_CONTRACT, createCorefHost, type CorefHostConfig, type GraphRun, type HostTensor,
} from './corefHost';

// The Python reference run over the fixture passages (scripts/coref/record_host_fixtures.py).
interface Recorded {
  id: string;
  seqLength: number;
  k: number;
  logits: string;
  inputIds: number[];
  starts: number[];
  ends: number[];
  categories?: string;
  clusters: [number, number][][];
}
type Model = 'big' | 'small';

const fixture = (name: string) => new URL(`./__fixtures__/${name}`, import.meta.url);
const reference = JSON.parse(readFileSync(fixture('reference.json'), 'utf8')) as
  Record<Model, { config: Omit<CorefHostConfig, 'graphContract'>; passages: Recorded[] }>;
const passages = new Map((JSON.parse(readFileSync(fixture('passages.json'), 'utf8')) as
  { passages: { id: string; text: string }[] }).passages.map((p) => [p.id, p.text]));
const tokenizer = JSON.parse(readFileSync(fixture('tokenizer.json'), 'utf8')) as TokenizerJson;

const asNumbers = (t: HostTensor) => Array.from(t.data as ArrayLike<number | bigint>, Number);
const sentinel = (dims: number[]): HostTensor => ({ type: 'float32', data: new Float32Array(1), dims });

/** Graphs that answer with the recorded outputs and record what the host fed them. */
function recordedGraphs(model: Model, rec: Recorded) {
  const { maxSpanLength, maxSegmentLen } = reference[model].config;
  const blob = readFileSync(fixture(rec.logits));
  const floats = new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
  const S = rec.seqLength;
  const fed: { a?: Record<string, HostTensor>; b?: Record<string, HostTensor> } = {};
  const seqOut = sentinel([1, S, 8]);
  const a: GraphRun = async (feeds) => {
    fed.a = feeds;
    const stride = model === 'big' ? S : feeds.input_ids.dims[0] * maxSegmentLen;
    const ml = new Float32Array(stride * stride).fill(-10000);
    let at = 0;
    for (let i = 0; i < S; i++) for (let j = i; j < Math.min(S, i + maxSpanLength); j++) ml[i * stride + j] = floats[at++];
    const mention_logits: HostTensor = { type: 'float32', data: ml, dims: [1, stride, stride] };
    const out: Record<string, HostTensor> = model === 'big' ? { sequence_output: seqOut, mention_logits }
      : { start_reps: seqOut, end_reps: seqOut, mention_logits };
    return out;
  };
  const bandSize = Array.from({ length: S }, (_, i) => Math.min(S, i + maxSpanLength) - i).reduce((x, y) => x + y, 0);
  const b: GraphRun = async (feeds) => {
    fed.b = feeds;
    const final = floats.slice(bandSize, bandSize + rec.k * (rec.k + 1));
    return { final_logits: { type: 'float32', data: final, dims: [1, rec.k, rec.k + 1] } };
  };
  return { graphs: { a, b }, fed, seqOut };
}

const cases = (['big', 'small'] as const).flatMap((model) => reference[model].passages.map((rec) => ({ model, rec })));

describe('createCorefHost', () => {
  it.each(cases)('$model model gives the Python clusters for $rec.id', async ({ model, rec }) => {
    const { graphs, fed, seqOut } = recordedGraphs(model, rec);
    const host = createCorefHost({ ...reference[model].config, graphContract: COREF_GRAPH_CONTRACT }, tokenizer, graphs);

    const clusters = await host.resolve(passages.get(rec.id)!);

    expect(clusters).toEqual(rec.clusters);
    const a = fed.a!;
    const mask = asNumbers(a.attention_mask);
    expect(asNumbers(a.input_ids).filter((_, i) => mask[i] === 1)).toEqual(rec.inputIds);
    const b = fed.b!;
    expect(asNumbers(b.starts)).toEqual(rec.starts);
    expect(asNumbers(b.ends)).toEqual(rec.ends);
    if (model === 'big') {
      expect(b.sequence_output).toBe(seqOut);
      const k = rec.k;
      const masks = asNumbers(b.categories_masks);
      const labels = Array.from({ length: k * k }, (_, p) => {
        const c = [0, 1, 2, 3, 4, 5].find((cat) => masks[cat * k * k + p] === 1);
        return c === undefined ? '.' : String(c);
      }).join('');
      expect(labels).toBe(rec.categories);
      expect(masks.slice(6 * k * k).filter(Boolean).length).toBe((k * (k - 1)) / 2);
    } else {
      expect(b.start_reps).toBe(seqOut);
    }
  });

  it('feeds the small model padded segments with per-segment positions', async () => {
    const rec = reference.small.passages.find((p) => p.seqLength > 512)!;
    const { graphs, fed } = recordedGraphs('small', rec);
    await createCorefHost({ ...reference.small.config, graphContract: COREF_GRAPH_CONTRACT }, tokenizer, graphs)
      .resolve(passages.get(rec.id)!);

    const a = fed.a!;
    expect(a.input_ids.dims).toEqual([2, 512]);
    const pos = asNumbers(a.position_ids);
    expect(pos.slice(510, 514)).toEqual([512, 513, 2, 3]);
    expect(pos[rec.seqLength]).toBe(1);
    expect(asNumbers(a.input_ids)[rec.seqLength]).toBe(1);
  });

  it('gives no clusters past the longest passage the model takes', async () => {
    const rec = reference.big.passages[0];
    const { graphs, fed } = recordedGraphs('big', rec);
    const host = createCorefHost({ ...reference.big.config, maxDocLen: 10, graphContract: COREF_GRAPH_CONTRACT }, tokenizer, graphs);

    expect(await host.resolve(passages.get(rec.id)!)).toEqual([]);
    expect(fed.a).toBeUndefined();
  });

  it('links a mention to the first of equal best antecedents, as numpy argmax does', () => {
    const spans = [{ start: 0, end: 0 }, { start: 1, end: 1 }, { start: 2, end: 2 }];
    // Rows: spans 0 and 1 have no antecedent; span 2 ties between 0 and 1.
    const tied = Float32Array.from([
      -1e4, -1e4, -1e4, 0,
      -1e4, -1e4, -1e4, 0,
      3, 3, -1e4, 0,
    ]);
    expect(buildClusters(tied, 3, spans)).toEqual([[spans[0], spans[2]]]);
    // Span 1 → 0, then span 2 → 1 joins that cluster.
    const chain = Float32Array.from([-1e4, -1e4, -1e4, 0, 5, -1e4, -1e4, 0, -1e4, 2, -1e4, 0]);
    expect(buildClusters(chain, 3, spans)).toEqual([[spans[0], spans[1], spans[2]]]);
  });

  it('refuses a model built for another graph contract', () => {
    const { graphs } = recordedGraphs('big', reference.big.passages[0]);
    expect(() => createCorefHost({ ...reference.big.config, graphContract: COREF_GRAPH_CONTRACT + 1 }, tokenizer, graphs))
      .toThrow(/graph contract/);
  });
});
