import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { deriveModelsUrls } from '@/lib/contextLength';
import { isDesktop, listLocalModels, localLlmStatus } from '@/lib/imageGen/desktop';

/** Which AI the app is pointed at: the desktop's bundled engine, or any user-configured endpoint. */
export type AiMode = 'local' | 'custom';

/** Why the AI isn't usable — drives which remedy the setup gate offers. */
export type AiBlocker =
  | 'noModel'      // local engine, nothing downloaded yet — the first-run case
  | 'engineDown'   // local engine has a model but it isn't loaded (e.g. it failed to fit in VRAM)
  | 'unreachable'  // custom endpoint didn't answer
  | 'unknownModel'; // endpoint answered, but it doesn't serve the model we're configured to ask for

/** Outcome of a single endpoint probe. `unknownModel` is a *reachable* server we still can't play on. */
export type EndpointProbe = 'ok' | 'unreachable' | 'unknownModel';

/** The rows of an OpenAI `/v1/models` (or LM Studio `/api/v0/models`) body. */
function modelRows(body: unknown): { id?: unknown; state?: unknown }[] {
  const data = (body as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as { id?: unknown; state?: unknown }[]) : [];
}

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

/**
 * Ask an OpenAI-compatible endpoint whether it can serve a turn, by listing its models. Cheap (no
 * generation, no tokens) and works for both LM Studio and hosted endpoints. Never throws.
 *
 * There is exactly one failure this can prove without generating, and it needs LM Studio's native list
 * (the only one that reports load `state`): nothing is loaded *and* the name we'd ask for isn't one it
 * could load, so the request dies on "No models loaded". That is the stock-config trap — an endpoint
 * pointed at LM Studio while the model name is still `default`.
 *
 * Everything else is deliberately allowed through, because a name being absent from the list does NOT
 * mean the request fails — LM Studio serves whatever is loaded when it doesn't recognize the name, and
 * llama.cpp behaves the same way. Guessing otherwise locks people out of a working setup, which is the
 * worse error. Proves the server is up and could route the request; not that the model generates.
 */
export async function probeEndpoint(
  endpointUrl: string,
  apiToken: string,
  modelName: string,
): Promise<EndpointProbe> {
  const urls = deriveModelsUrls(endpointUrl);
  if (!urls) return 'unreachable';
  const headers: Record<string, string> = apiToken ? { Authorization: `Bearer ${apiToken}` } : {};

  // LM Studio's native list first — it carries `state`, which is what makes the one provable call provable.
  try {
    const res = await fetch(urls.lmstudio, { headers });
    if (res.ok) {
      const rows = modelRows(await res.json().catch(() => null));
      const loaded = rows.some((m) => m.state === 'loaded');
      const known = rows.some((m) => m.id === modelName);
      // A loaded model answers to any name; an unloaded one still loads on demand if we name it.
      return loaded || known || !rows.length ? 'ok' : 'unknownModel';
    }
  } catch {
    // not LM Studio — fall through to the generic list
  }

  // Any other server: reaching the list is all we can honestly conclude.
  try {
    const res = await fetch(urls.openai, { headers });
    if (res.ok) return 'ok';
  } catch {
    // unreachable
  }
  return 'unreachable';
}

/**
 * Whether the configured AI can actually serve a turn, plus why not. The bundled desktop engine reports
 * its own state over IPC (free, already live, and proves the model loaded); any custom endpoint — on
 * desktop or web — is probed instead. Stays `null` until the answer is known, so callers never flash a
 * gate during boot.
 */
export function useAiReachable(): AiReachable {
  const { localModelActive, activeEndpointUrl, activeApiToken, activeModelName } = useSettings();
  const engine = useLocalLlmStatus();
  const mode: AiMode = localModelActive ? 'local' : 'custom';
  const [nonce, setNonce] = useState(0);
  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  // Custom endpoint: probe, re-running whenever the endpoint identity changes or a recheck is asked for.
  const [probe, setProbe] = useState<EndpointProbe | null>(null);
  useEffect(() => {
    if (mode !== 'custom') return;
    let active = true;
    setProbe(null);
    probeEndpoint(activeEndpointUrl, activeApiToken, activeModelName)
      .then((result) => { if (active) setProbe(result); });
    return () => { active = false; };
  }, [mode, activeEndpointUrl, activeApiToken, activeModelName, nonce]);

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

  // Fresh point-in-time check that bypasses the cached probe/engine state — the launch guard calls this so a
  // stale answer can't gate a working setup. Also seeds the cached state so the UI catches up. Never throws.
  const revalidate = useCallback(async (): Promise<boolean> => {
    if (mode === 'custom') {
      const result = await probeEndpoint(activeEndpointUrl, activeApiToken, activeModelName);
      setProbe(result);
      return result === 'ok';
    }
    if (!isDesktop()) return false;
    const st = await localLlmStatus().catch(() => null);
    return st?.status === 'ready';
  }, [mode, activeEndpointUrl, activeApiToken, activeModelName]);

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
