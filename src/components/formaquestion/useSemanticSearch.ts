import { useCallback, useRef, useState } from 'react';
import { isEmbeddingModelCached, isEmbeddingModelReady, loadEmbeddingModel, type EmbeddingLoadProgress } from '@/lib/embeddingWorkerClient';
import { useMountedRef } from '@/lib/useMountedRef';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';

/** The Semantic Search switch: its state, and the one download it starts. */
export interface SemanticSearch {
  /** The switch is on: the source is on, or its model is downloading. */
  readonly on: boolean;
  readonly downloading: boolean;
  readonly progress: EmbeddingLoadProgress | null;
  /** The message of the last failed download; none after a retry starts or the switch goes off. */
  readonly error: string | null;
  setOn: (on: boolean) => void;
}

/**
 * Held above the settings dialog, so closing it keeps a download. The source goes on only when the model is
 * on the device: a question asked during the download uses the other sources, and a failed download leaves
 * the source off.
 */
export function useSemanticSearch(settings: HelpSettings, change: (next: HelpSettingsChange) => void): SemanticSearch {
  const mounted = useMountedRef();
  const attempt = useRef(0);
  const loading = useRef<Promise<void> | null>(null);
  const onProgress = useRef<(next: EmbeddingLoadProgress) => void>(() => {});
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<EmbeddingLoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setOn = useCallback((on: boolean) => {
    const mine = ++attempt.current;
    const current = () => mounted.current && attempt.current === mine;
    setError(null);
    setProgress(null);
    if (!on) {
      setDownloading(false);
      change({ sources: { semantic: false } });
      return;
    }
    setDownloading(true);
    void (async () => {
      try {
        if (!isEmbeddingModelReady() && !(await isEmbeddingModelCached())) {
          onProgress.current = (next) => { if (current()) setProgress(next); };
          // A switch off and on again joins the download in flight.
          loading.current ??= loadEmbeddingModel((next) => onProgress.current(next)).finally(() => { loading.current = null; });
          await loading.current;
        }
        if (!current()) return;
        change({ sources: { semantic: true } });
      } catch (failure) {
        if (current()) setError(failure instanceof Error ? failure.message : 'The download failed');
      } finally {
        if (current()) {
          setDownloading(false);
          setProgress(null);
        }
      }
    })();
  }, [change, mounted]);

  return { on: settings.sources.semantic || downloading, downloading, progress, error, setOn };
}
