// Writes src/lib/formaquestion/sectionVectors.json: one embedding per guide section, for the semantic help
// source. A section whose text did not change keeps its vector. Run with `npm run build:help-vectors`.
// The first run downloads the embedding model (about 23 MB) into the transformers.js cache.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { encodeVector, sectionTexts, type SectionVectorsFile } from '@/lib/formaquestion/sectionVectors';
import { EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';

const OUT = 'src/lib/formaquestion/sectionVectors.json';
const BATCH = 16;

type Extractor = (texts: string[], options: { pooling: 'mean'; normalize: true }) => Promise<{ dims: number[]; data: Float32Array; dispose(): void }>;

const texts = sectionTexts(bundledDocsIndex());
const before: SectionVectorsFile | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) as SectionVectorsFile : null;
const kept = new Map((before?.model === EMBEDDING_MODEL_ID ? before.sections : []).map((entry) => [`${entry.id}\n${entry.hash}`, entry.vector]));
const stale = texts.filter(({ section, hash }) => !kept.has(`${section.id}\n${hash}`));

let dims = before?.model === EMBEDDING_MODEL_ID ? before.dims : 0;
if (stale.length > 0) {
  // The app's worker loads the same model and weights (`embeddingWorker.ts`); it runs them on WASM, this on the Node runtime.
  const { pipeline } = await import('@huggingface/transformers');
  // The pipeline's own type is a union too large for tsc to resolve; `Extractor` is the one call this script makes.
  const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL_ID, { dtype: 'q8' }) as unknown as Extractor;
  for (let at = 0; at < stale.length; at += BATCH) {
    const batch = stale.slice(at, at + BATCH);
    const output = await extractor(batch.map(({ text }) => text), { pooling: 'mean', normalize: true });
    const [rows, width] = output.dims;
    dims = width;
    for (let r = 0; r < rows; r++) kept.set(`${batch[r].section.id}\n${batch[r].hash}`, encodeVector(output.data.slice(r * width, (r + 1) * width)));
    output.dispose();
  }
}

// One section on each line, so a docs edit changes only the lines of its sections.
const lines = texts.map(({ section, hash }) => JSON.stringify({ id: section.id, hash, vector: kept.get(`${section.id}\n${hash}`) }));
writeFileSync(OUT, `{\n"model": ${JSON.stringify(EMBEDDING_MODEL_ID)},\n"dims": ${dims},\n"sections": [\n${lines.join(',\n')}\n]\n}\n`);
console.log(`${OUT}: ${texts.length} sections, ${stale.length} embedded, ${texts.length - stale.length} kept`);
