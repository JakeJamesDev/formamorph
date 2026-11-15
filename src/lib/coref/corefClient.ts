/**
 * The Coref Host's main-thread side: loads one model into the coref worker and resolves passages there.
 * The caller (the Coref Model Store) supplies the model's files.
 */
import { createWorkerClient } from '@/lib/createWorkerClient';
import type { TokenizerJson } from './bpe';
import type { CorefCluster, CorefHostConfig } from './corefHost';
import type { CorefDevice } from './corefWorker';

export type { CorefDevice };
export { COREF_GRAPH_CONTRACT, type CorefCluster, type CorefHostConfig, type CharSpan } from './corefHost';

/** One model's files, as the manifest lists them. The graph buffers move to the worker. */
export interface CorefModelFiles {
  config: CorefHostConfig;
  tokenizer: TokenizerJson;
  graphA: ArrayBuffer;
  graphB: ArrayBuffer;
}

const client = createWorkerClient(() => new Worker(new URL('./corefWorker.ts', import.meta.url), { type: 'module' }));

/** Load a model, replacing any loaded one. */
export async function loadCorefModel(files: CorefModelFiles, device: CorefDevice): Promise<void> {
  await client.run({ cmd: 'load', ...files, device }, undefined, [files.graphA, files.graphB]);
}

/** The loaded model's clusters for one finished passage. */
export async function resolveCoreference(text: string): Promise<CorefCluster[]> {
  return (await client.run({ cmd: 'resolve', text })) as CorefCluster[];
}

/** Free the model's sessions and stop the worker. */
export async function disposeCoref(): Promise<void> {
  try {
    await client.run({ cmd: 'dispose' });
  } finally {
    client.terminate();
  }
}
