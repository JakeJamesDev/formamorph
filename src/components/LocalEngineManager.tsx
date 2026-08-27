import { useEffect } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import {
  isDesktop,
  setLocalLlmOptions,
  localLlmStatus,
  listLocalInstalled,
  loadLocalModel,
  stopLocalLlm,
} from '@/lib/imageGen/desktop';

/**
 * Drives the desktop local-LLM engine lifecycle. The engine runs whenever anything references it — it's the
 * selected endpoint, or some prompt is routed to it — and stops otherwise, to free VRAM. Keying off
 * "referenced" rather than "selected" is what lets one prompt run on the engine while the rest go outward;
 * keyed off the selection alone, such a prompt would fire at a port this manager had just stopped.
 *
 * Runs on mount and whenever that changes. Setting *changes* are applied by the panel's Save & Reload
 * button, not here — so dragging a slider doesn't reload the model. Auto-load is the exception: turning it
 * back on picks up a stopped engine right away. No-op off desktop; renders nothing.
 * Mount once near the app root (inside SettingsProvider).
 */
export function LocalEngineManager() {
  const { engineWanted, localContextSize, localGpuLayers, localFlashAttention, localParallelRequests, localGpuDevice, localAutoLoad } = useSettings();

  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    (async () => {
      if (!engineWanted) {
        await stopLocalLlm().catch(() => { /* ignore */ });
        return;
      }
      await setLocalLlmOptions({ contextSize: localContextSize, gpuLayers: localGpuLayers, flashAttention: localFlashAttention, parallelRequests: localParallelRequests, gpuDevice: localGpuDevice }).catch(() => { /* ignore */ });
      if (cancelled) return;
      if (!localAutoLoad) return;
      const st = await localLlmStatus().catch(() => null);
      if (cancelled || !st || st.status !== 'stopped') return;
      const models = await listLocalInstalled().catch(() => []);
      if (cancelled || !models.length) return;
      // Prefer a model in our own folder — an external library is a bonus, not the auto-start default.
      const pick = models.find((m) => m.source === 'root') ?? models[0];
      await loadLocalModel(pick.id).catch(() => { /* ignore */ });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setting changes apply via Save & Reload, not here
  }, [engineWanted, localAutoLoad]);

  return null;
}
