import { useState } from 'react';
import type { EmbeddingLoadProgress } from '@/lib/embeddingWorkerClient';

/** The embedding-model download the semantic toggles start, with the state its progress row shows. */
export interface EmbeddingDownload {
  loading: boolean;
  progress: EmbeddingLoadProgress | null;
  error: string | null;
  start: () => void;
  dispose: () => void;
}

/** Download state held above the tab bodies, which unmount when hidden; a failed download leaves the toggle on. */
export function useEmbeddingDownload(
  load: (onProgress: (p: EmbeddingLoadProgress) => void) => Promise<unknown>,
  dispose: () => void,
): EmbeddingDownload {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<EmbeddingLoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = () => {
    setLoading(true);
    setError(null);
    setProgress(null);
    load(setProgress)
      .then(() => setError(null))
      .catch((err) => setError((err as Error).message))
      .finally(() => { setLoading(false); setProgress(null); });
  };
  return { loading, progress, error, start, dispose };
}
