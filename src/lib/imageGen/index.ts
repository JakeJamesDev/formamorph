// Entry point for AI image generation: dispatch a common request to the selected provider.
// Local providers (A1111) fetch directly from the browser; cloud providers are added in the desktop slice.
import { a1111Provider } from './a1111';
import { openaiProvider } from './openai';
import { comfyuiProvider } from './comfyui';
import { invokeaiProvider } from './invokeai';
import { novelaiProvider } from './novelai';
import type { ImageGenOpts, ImageGenParams, ImageProvider, ImageProviderId } from './types';

export type { ImageGenParams, ImageGenOpts, ImageProviderId } from './types';
export { buildImageRequest, type ImageSettings, type ImageRequest } from './request';

/** Per-provider default endpoint, used when the Endpoint field is left blank. Local providers have a
 *  standard loopback address; the cloud provider has none (a base URL must be entered). */
export const DEFAULT_ENDPOINT_BY_PROVIDER: Record<ImageProviderId, string> = {
  a1111: 'http://127.0.0.1:7860',
  comfyui: 'http://127.0.0.1:8188',
  invokeai: 'http://127.0.0.1:9090',
  novelai: 'https://image.novelai.net',
  openai: '',
};

/** The endpoint to actually call: the entered URL, or the provider default when blank. */
export function resolveImageEndpoint(provider: ImageProviderId, endpoint: string): string {
  return endpoint.trim() || DEFAULT_ENDPOINT_BY_PROVIDER[provider];
}

const PROVIDERS: Record<ImageProviderId, ImageProvider> = {
  a1111: a1111Provider,
  openai: openaiProvider, // cloud: desktop-only guard lives in desktopFetch
  comfyui: comfyuiProvider, // local: direct fetch + WebSocket, like a1111
  invokeai: invokeaiProvider, // local: direct fetch + queue polling
  novelai: novelaiProvider, // cloud, but CORS-open: direct fetch, no desktop bridge
};

/** Generate one image via the given provider, returning a base64 data-URL. Throws on failure. */
export async function generateImage(
  provider: ImageProviderId,
  params: ImageGenParams,
  opts: ImageGenOpts,
): Promise<string> {
  const impl = PROVIDERS[provider];
  if (!impl) throw new Error(`Unknown image provider: ${provider}`);
  return impl(params, opts);
}
