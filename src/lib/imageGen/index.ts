// Entry point for AI image generation: dispatch a common request to the selected provider.
// Local providers (A1111) fetch directly from the browser; cloud providers are added in the desktop slice.
import { a1111Provider } from './a1111';
import { openaiProvider } from './openai';
import type { ImageGenOpts, ImageGenParams, ImageProvider, ImageProviderId } from './types';

export type { ImageGenParams, ImageGenOpts, ImageProviderId } from './types';

const PROVIDERS: Record<ImageProviderId, ImageProvider> = {
  a1111: a1111Provider,
  openai: openaiProvider, // cloud: desktop-only guard lives in desktopFetch
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
