// Reachability probes for image servers. Each reads a free list endpoint; none sends a generation request.
import type { EndpointProbe } from '@/lib/useAiReachable';
import type { ReachabilityTarget } from '@/lib/useEndpointReachable';
import type { ImageProviderId } from './types';
import { authHeaders, trimUrl } from './http';
import { desktopFetch, isDesktop } from './desktop';
import { fetchInvokeModels, findModel, SUPPORTED_INVOKE_BASES } from './invokeai';
import { OPENAI_DEFAULT_MODEL } from './openai';
import { resolveImageEndpoint } from './index';

/** Probe one provider's server at `base`, a trimmed non-empty URL. */
type ProviderProbe = (base: string, apiToken: string, model: string) => Promise<EndpointProbe>;

/** GET `url`. Resolves to `{ body }`, with a null body for unreadable JSON, or to undefined when the server
 *  is down or refuses. */
async function getJson(url: string, headers: Record<string, string>): Promise<{ body: unknown } | undefined> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return undefined;
    return { body: await res.json().catch(() => null) };
  } catch {
    return undefined;
  }
}

// Its checkpoint list doesn't cover every loader a workflow can use, so only reachability counts.
const probeComfy: ProviderProbe = async (base, apiToken) =>
  (await getJson(`${base}/object_info/KSampler`, authHeaders(apiToken, 'Bearer'))) ? 'ok' : 'unreachable';

// Generation needs a named main model of a supported base; a blank model has no default to fall back on.
const probeInvoke: ProviderProbe = async (base, apiToken, model) => {
  let models;
  try {
    models = await fetchInvokeModels(base, apiToken);
  } catch {
    return 'unreachable';
  }
  const usable = models.filter((m) => m.type === 'main' && (SUPPORTED_INVOKE_BASES as readonly string[]).includes(m.base));
  return findModel(usable, model) ? 'ok' : 'unknownModel';
};

/** Whether A1111 resolves `model` to a listed checkpoint, by the rules of its `get_closet_checkpoint_match`:
 *  an exact alias, else a case-sensitive substring of a title, with or without the ` [hash]` part. */
function a1111Has(rows: unknown, model: string): boolean {
  if (!Array.isArray(rows)) return false;
  const bare = model.replace(/\s\[[^\]]*\]/g, '');
  return rows.some((row: { title?: unknown; model_name?: unknown; hash?: unknown; sha256?: unknown }) => {
    const title = typeof row?.title === 'string' ? row.title : '';
    return [row?.model_name, row?.hash, row?.sha256].includes(model) || title.includes(model) || title.includes(bare);
  });
}

// A blank model keeps the checkpoint the WebUI has loaded.
const probeA1111: ProviderProbe = async (base, apiToken, model) => {
  const res = await getJson(`${base}/sdapi/v1/sd-models`, authHeaders(apiToken, 'Basic'));
  if (!res) return 'unreachable';
  return !model.trim() || a1111Has(res.body, model.trim()) ? 'ok' : 'unknownModel';
};

// Cloud keys can't be sent from a browser, so the list goes through the desktop bridge.
const probeOpenAI: ProviderProbe = async (base, apiToken, model) => {
  try {
    const res = await desktopFetch({ url: `${base}/v1/models`, method: 'GET', headers: authHeaders(apiToken, 'Bearer') });
    if (!res.ok) return 'unreachable';
    const rows = (JSON.parse(res.body) as { data?: { id?: unknown }[] })?.data;
    // A gateway that lists nothing proves only that it answered.
    if (!Array.isArray(rows) || !rows.length) return 'ok';
    const want = model.trim() || OPENAI_DEFAULT_MODEL;
    return rows.some((m) => m?.id === want) ? 'ok' : 'unknownModel';
  } catch {
    return 'unreachable';
  }
};

/** Each provider's free check. NovelAI has none. */
const PROBES: Record<ImageProviderId, { probe: ProviderProbe; desktopOnly?: true } | null> = {
  comfyui: { probe: probeComfy },
  invokeai: { probe: probeInvoke },
  a1111: { probe: probeA1111 },
  openai: { probe: probeOpenAI, desktopOnly: true },
  novelai: null,
};

/** Whether `provider` has a free check in this build. */
export function imageProbeSupported(provider: ImageProviderId): boolean {
  const entry = PROBES[provider];
  return !!entry && (!entry.desktopOnly || isDesktop());
}

/**
 * Whether the image server at `endpointUrl` answers, and for a provider with a model list whether it can
 * serve `model`. A provider without a check in this build reads as unreachable. Never throws.
 */
export async function probeImageEndpoint(
  provider: ImageProviderId,
  endpointUrl: string,
  apiToken: string,
  model: string,
): Promise<EndpointProbe> {
  const base = trimUrl(endpointUrl);
  const entry = PROBES[provider];
  if (!base || !entry || !imageProbeSupported(provider)) return 'unreachable';
  return entry.probe(base, apiToken, model);
}

/** The settings that decide the active image preset's badge. */
export interface ImagePresetSettings {
  imageProvider: ImageProviderId;
  imageEndpoint: string;
  imageApiToken: string;
  imageModel: string;
  imageGenDisabled: boolean;
}

/** The badge target for the active image preset. Every surface builds it here, so they share one cache entry. */
export function imageReachabilityTarget(s: ImagePresetSettings): ReachabilityTarget {
  return {
    provider: s.imageProvider,
    url: resolveImageEndpoint(s.imageProvider, s.imageEndpoint),
    apiToken: s.imageApiToken,
    model: s.imageProvider === 'openai' ? s.imageModel.trim() || OPENAI_DEFAULT_MODEL : s.imageModel,
    enabled: !s.imageGenDisabled && imageProbeSupported(s.imageProvider),
  };
}
