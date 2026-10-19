import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import type { AiEndpointTarget } from '@/lib/aiRequest/aiRequestSpec';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { probeEndpoint, type EndpointProbe } from '@/lib/textEndpointProbe';
import { isDesktop, listLocalModels, localLlmStatus } from '@/lib/imageGen/desktop';

/** Which AI the app is pointed at: the desktop's bundled engine, or any user-configured endpoint. */
export type AiMode = 'local' | 'custom';

/** Why the AI isn't usable — drives which remedy the setup gate offers. */
export type AiBlocker =
  | 'noModel'      // local engine, nothing downloaded yet — the first-run case
  | 'engineDown'   // local engine has a model but it isn't loaded (e.g. it failed to fit in VRAM)
  | 'unreachable'  // custom endpoint didn't answer
  | 'unknownModel'; // endpoint answered, but it doesn't serve the model we're configured to ask for

export interface AiReachable {
  /** true = usable, false = blocked, null = still determining (never render a gate on null). */
  reachable: boolean | null;
  mode: AiMode;
  /** Only meaningful while `reachable === false`. */
  blocker: AiBlocker | null;
  recheck: () => void;
  /** Run a FRESH probe right now and resolve to whether the AI is reachable. Use before gating a launch so a
   *  stale `false` (e.g. the endpoint probed before its model was loaded) can't block a now-working setup. */
  revalidate: () => Promise<boolean>;
}

export { probeEndpoint, type EndpointProbe } from '@/lib/textEndpointProbe';

/** One resolved endpoint to check in place of the active one. */
export type ReachableTarget = Pick<AiEndpointTarget, 'localEngine' | 'url' | 'apiToken' | 'model'>;

/**
 * Whether the configured AI can actually serve a turn, plus why not. The bundled desktop engine reports
 * its own state over IPC (free, already live, and proves the model loaded); any custom endpoint — on
 * desktop or web — is probed instead. Stays `null` until the answer is known, so callers never flash a
 * gate during boot. With `enabled` false it starts no check, so a custom endpoint that was never checked
 * stays `null`. A `target` is checked in place of the active endpoint.
 */
export function useAiReachable({ enabled = true, target }: { enabled?: boolean; target?: ReachableTarget } = {}): AiReachable {
  const settings = useSettings();
  const localEngine = target ? target.localEngine : settings.localModelActive;
  const url = target ? target.url : settings.activeEndpointUrl;
  const apiToken = target ? target.apiToken : settings.activeApiToken;
  const model = target ? target.model : settings.activeModelName;
  const engine = useLocalLlmStatus();
  const mode: AiMode = localEngine ? 'local' : 'custom';
  const [nonce, setNonce] = useState(0);
  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  // Custom endpoint: probe, re-running whenever the endpoint identity changes or a recheck is asked for.
  const [probe, setProbe] = useState<EndpointProbe | null>(null);
  useEffect(() => {
    if (mode !== 'custom' || !enabled) return;
    let active = true;
    setProbe(null);
    probeEndpoint(url, apiToken, model)
      .then((result) => { if (active) setProbe(result); });
    return () => { active = false; };
  }, [mode, enabled, url, apiToken, model, nonce]);

  // Local engine: whether any GGUF is on disk at all. Distinguishes "nothing downloaded" (offer a download)
  // from "downloaded but won't load" (send them to the panel) — and keeps us at `null` until it's known,
  // since the engine reports 'stopped' both before boot completes and when it's genuinely idle.
  const [hasModel, setHasModel] = useState<boolean | null>(null);
  useEffect(() => {
    if (mode !== 'local' || !enabled || !isDesktop()) return;
    let active = true;
    listLocalModels()
      .then((m) => { if (active) setHasModel(m.length > 0); })
      .catch(() => { if (active) setHasModel(false); });
    return () => { active = false; };
  }, [mode, enabled, nonce, engine.status]);

  // Fresh point-in-time check that bypasses the cached probe/engine state — the launch guard calls this so a
  // stale answer can't gate a working setup. Also seeds the cached state so the UI catches up. Never throws.
  const revalidate = useCallback(async (): Promise<boolean> => {
    if (mode === 'custom') {
      const result = await probeEndpoint(url, apiToken, model);
      setProbe(result);
      return result === 'ok';
    }
    if (!isDesktop()) return false;
    const st = await localLlmStatus().catch(() => null);
    return st?.status === 'ready';
  }, [mode, url, apiToken, model]);

  if (mode === 'custom') {
    return {
      reachable: probe === null ? null : probe === 'ok',
      mode,
      blocker: probe === null || probe === 'ok' ? null : probe,
      recheck,
      revalidate,
    };
  }

  if (engine.status === 'ready') return { reachable: true, mode, blocker: null, recheck, revalidate };
  // Mid-load, or we don't yet know what's on disk — undecided rather than blocked.
  if (engine.status === 'loading' || hasModel === null) return { reachable: null, mode, blocker: null, recheck, revalidate };
  return { reachable: false, mode, blocker: hasModel ? 'engineDown' : 'noModel', recheck, revalidate };
}
