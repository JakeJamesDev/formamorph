import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { deriveModelsUrls } from '@/lib/contextLength';
import { isDesktop, listLocalModels } from '@/lib/imageGen/desktop';

/** Which AI the app is pointed at: the desktop's bundled engine, or any user-configured endpoint. */
export type AiMode = 'local' | 'custom';

/** Why the AI isn't usable — drives which remedy the setup gate offers. */
export type AiBlocker =
  | 'noModel'      // local engine, nothing downloaded yet — the first-run case
  | 'engineDown'   // local engine has a model but it isn't loaded (e.g. it failed to fit in VRAM)
  | 'unreachable'; // custom endpoint didn't answer

export interface AiReachable {
  /** true = usable, false = blocked, null = still determining (never render a gate on null). */
  reachable: boolean | null;
  mode: AiMode;
  /** Only meaningful while `reachable === false`. */
  blocker: AiBlocker | null;
  recheck: () => void;
}

/**
 * Ask an OpenAI-compatible endpoint whether it's answering, by listing its models. Cheap (no generation,
 * no tokens) and works for both LM Studio and hosted endpoints. Proves the server is up — not that the
 * model generates. Never throws.
 */
export async function probeEndpoint(endpointUrl: string, apiToken: string): Promise<boolean> {
  const urls = deriveModelsUrls(endpointUrl);
  if (!urls) return false;
  const headers: Record<string, string> = apiToken ? { Authorization: `Bearer ${apiToken}` } : {};
  for (const url of [urls.openai, urls.lmstudio]) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return true;
    } catch {
      // try the next shape
    }
  }
  return false;
}

/**
 * Whether the configured AI can actually serve a turn, plus why not. The bundled desktop engine reports
 * its own state over IPC (free, already live, and proves the model loaded); any custom endpoint — on
 * desktop or web — is probed instead. Stays `null` until the answer is known, so callers never flash a
 * gate during boot.
 */
export function useAiReachable(): AiReachable {
  const { localModelActive, activeEndpointUrl, activeApiToken } = useSettings();
  const engine = useLocalLlmStatus();
  const mode: AiMode = localModelActive ? 'local' : 'custom';
  const [nonce, setNonce] = useState(0);
  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  // Custom endpoint: probe, re-running whenever the endpoint identity changes or a recheck is asked for.
  const [probe, setProbe] = useState<boolean | null>(null);
  useEffect(() => {
    if (mode !== 'custom') return;
    let active = true;
    setProbe(null);
    probeEndpoint(activeEndpointUrl, activeApiToken).then((ok) => { if (active) setProbe(ok); });
    return () => { active = false; };
  }, [mode, activeEndpointUrl, activeApiToken, nonce]);

  // Local engine: whether any GGUF is on disk at all. Distinguishes "nothing downloaded" (offer a download)
  // from "downloaded but won't load" (send them to the panel) — and keeps us at `null` until it's known,
  // since the engine reports 'stopped' both before boot completes and when it's genuinely idle.
  const [hasModel, setHasModel] = useState<boolean | null>(null);
  useEffect(() => {
    if (mode !== 'local' || !isDesktop()) return;
    let active = true;
    listLocalModels()
      .then((m) => { if (active) setHasModel(m.length > 0); })
      .catch(() => { if (active) setHasModel(false); });
    return () => { active = false; };
  }, [mode, nonce, engine.status]);

  if (mode === 'custom') {
    return { reachable: probe, mode, blocker: probe === false ? 'unreachable' : null, recheck };
  }

  if (engine.status === 'ready') return { reachable: true, mode, blocker: null, recheck };
  // Mid-load, or we don't yet know what's on disk — undecided rather than blocked.
  if (engine.status === 'loading' || hasModel === null) return { reachable: null, mode, blocker: null, recheck };
  return { reachable: false, mode, blocker: hasModel ? 'engineDown' : 'noModel', recheck };
}
