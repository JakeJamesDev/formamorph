// The semantic help source's embedder for a probe in Node: the app's model and weights, with section vectors
// built in memory from the docs as they are now, as `npm run build:help-vectors` would write them.
import type { DocsIndex } from '@/lib/docs/docsIndex';
import type { HelpEmbedder } from '@/lib/formaquestion/helpSemantic';
import { encodeVector, sectionEntries, sectionTexts, type SectionVectorsFile } from '@/lib/formaquestion/sectionVectors';
import shippedVectors from '@/lib/formaquestion/sectionVectors.json';
import { EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';

type Extractor = (texts: string[], options: { pooling: 'mean'; normalize: true }) => Promise<{ dims: number[]; data: Float32Array; dispose(): void }>;

const BATCH = 16;

export interface NodeEmbedder {
  embedder: HelpEmbedder;
  /** The guide sections the shipped vectors file holds no current vector for. */
  stale: string[];
}

export async function nodeEmbedder(index: DocsIndex): Promise<NodeEmbedder> {
  const { pipeline } = await import('@huggingface/transformers');
  // The pipeline's own type is a union too large for tsc to resolve; `Extractor` is the one call made here.
  const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL_ID, { dtype: 'q8' }) as unknown as Extractor;
  // One model run at a time: the probe's parallel questions share one session.
  let queue: Promise<unknown> = Promise.resolve();
  const embed = (texts: string[]): Promise<Float32Array[]> => {
    const run = queue.then(async () => {
      const vectors: Float32Array[] = [];
      for (let at = 0; at < texts.length; at += BATCH) {
        const output = await extractor(texts.slice(at, at + BATCH), { pooling: 'mean', normalize: true });
        const [rows, width] = output.dims;
        for (let r = 0; r < rows; r++) vectors.push(output.data.slice(r * width, (r + 1) * width));
        output.dispose();
      }
      return vectors;
    });
    queue = run.catch(() => undefined);
    return run;
  };
  const texts = sectionTexts(index);
  const vectors = await embed(texts.map(({ text }) => text));
  const file: SectionVectorsFile = {
    model: EMBEDDING_MODEL_ID,
    dims: vectors[0]?.length ?? 0,
    sections: texts.map(({ section, hash }, at) => ({ id: section.id, hash, vector: encodeVector(vectors[at]) })),
  };
  const current = new Set(sectionEntries(index, shippedVectors as SectionVectorsFile).map((entry) => entry.id));
  return {
    embedder: { open: async () => true, embed, vectors: async () => file },
    stale: texts.map(({ section }) => section.id).filter((id) => !current.has(id)),
  };
}
