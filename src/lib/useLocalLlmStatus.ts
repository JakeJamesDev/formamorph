import { useEffect, useState } from 'react';
import {
  isLocalLlmAvailable,
  localLlmStatus,
  subscribeLocalLlm,
  type LocalLlmState,
} from '@/lib/imageGen/desktop';

const STOPPED: LocalLlmState = { status: 'stopped', modelPath: null, modelId: null, port: null, error: null, contextSize: null, gpuLayers: null, flashAttention: null };

/**
 * Live status of the desktop local-LLM engine. Reads the current state once on mount, then updates from
 * the main process's pushed status events (auto-start, loading, ready, error). Off desktop it stays
 * 'stopped'.
 */
export function useLocalLlmStatus(): LocalLlmState {
  const [state, setState] = useState<LocalLlmState>(STOPPED);

  useEffect(() => {
    if (!isLocalLlmAvailable()) return;
    let active = true;
    localLlmStatus().then((s) => { if (active) setState(s); }).catch(() => { /* ignore */ });
    const unsubscribe = subscribeLocalLlm((s) => { if (active) setState(s); });
    return () => { active = false; unsubscribe(); };
  }, []);

  return state;
}
