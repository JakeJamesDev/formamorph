import { useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import {
  isDesktop,
  setLocalLlmOptions,
  localLlmStatus,
  listLocalModels,
  loadLocalModel,
  stopLocalLlm,
} from '@/lib/imageGen/desktop';

/**
 * Drives the desktop local-LLM engine lifecycle by mode. When the local model is active it applies the
 * saved load options and loads a model if none is running; when a custom endpoint is on it stops the
 * engine to free VRAM. Runs on mount and whenever the mode flips. Setting *changes* are applied by the
 * panel's Save & Reload button, not here — so dragging a slider doesn't reload the model. No-op off
 * desktop; renders nothing. Mount once near the app root (inside SettingsProvider).
 */
export function LocalEngineManager() {
  const { localModelActive, localContextSize, localGpuLayers, localFlashAttention } = useSettings();

  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    (async () => {
      if (!localModelActive) {
        await stopLocalLlm().catch(() => { /* ignore */ });
        return;
      }
      await setLocalLlmOptions({ contextSize: localContextSize, gpuLayers: localGpuLayers, flashAttention: localFlashAttention }).catch(() => { /* ignore */ });
      if (cancelled) return;
      const st = await localLlmStatus().catch(() => null);
      if (cancelled || !st || st.status !== 'stopped') return;
      const models = await listLocalModels().catch(() => [] as string[]);
      if (cancelled || !models.length) return;
      await loadLocalModel(models[0]).catch(() => { /* ignore */ });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setting changes apply via Save & Reload, not here
  }, [localModelActive]);

  return null;
}
