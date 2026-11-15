import { describe, expect, it } from 'vitest';
import { entrySize, parseCorefManifest, parseHostConfig } from './corefManifest';

const file = (url: string, size = 10) => ({ url, size, sha256: 'A'.repeat(64) });
const model = (version: number, minHostVersion = 1) => ({
  version, architecture: 'fcoref', minHostVersion, scores: {},
  files: { graph_a: file('small/1/graph_a.onnx', 100), graph_b: file('/abs/graph_b.onnx'), tokenizer: file('https://cdn.test/t.json'), hostConfig: file('h.json') },
});

describe('the coref manifest', () => {
  it('reads each model, resolving file URLs against the manifest and lowering hashes', () => {
    const list = parseCorefManifest({ format: 1, models: { small: model(3) } }, 'https://assets.test/coref/manifest.json');
    expect(list.small?.version).toBe(3);
    expect(list.small?.files.graph_a.url).toBe('https://assets.test/coref/small/1/graph_a.onnx');
    expect(list.small?.files.graph_b.url).toBe('https://assets.test/abs/graph_b.onnx');
    expect(list.small?.files.tokenizer.url).toBe('https://cdn.test/t.json');
    expect(list.small?.files.hostConfig.sha256).toBe('a'.repeat(64));
    expect(entrySize(list.small!)).toBe(130);
  });

  it('skips a model that needs a newer graph contract, or is malformed', () => {
    const list = parseCorefManifest({ format: 1, models: { small: model(2, 2), big: { version: 1 } } }, 'https://a.test/');
    expect(list).toEqual({});
  });

  it('refuses an unknown format', () => {
    expect(() => parseCorefManifest({ format: 2, models: {} }, 'https://a.test/')).toThrow();
  });

  it('reads the training kit’s snake-case host config', () => {
    expect(parseHostConfig({ architecture: 'lingmess', top_lambda: 0.4, max_span_length: 30, max_segment_len: 512, graphContract: 1 }))
      .toEqual({ architecture: 'lingmess', topLambda: 0.4, maxSpanLength: 30, maxSegmentLen: 512, graphContract: 1 });
    expect(() => parseHostConfig({ architecture: 'lingmess', top_lambda: 0.4, max_span_length: 30, max_segment_len: 512, graphContract: 9 })).toThrow();
  });
});
