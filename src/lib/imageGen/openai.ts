// OpenAI-compatible Images provider. Cloud key APIs can't be called from a browser (CORS + key
// exposure), so this always routes through the Electron desktop bridge (net-fetch in the main process).
import type { ImageGenOpts, ImageGenParams, ImageProvider } from './types';
import { desktopFetch } from './desktop';
import { trimUrl, authHeaders } from './http';

// OpenAI's Images API only accepts a fixed set of sizes; snap the requested dimensions to the nearest
// by aspect ratio (square / portrait / landscape).
export function nearestOpenAISize(width: number, height: number): string {
  const ratio = width / Math.max(1, height);
  if (ratio > 1.2) return '1536x1024';
  if (ratio < 0.83) return '1024x1536';
  return '1024x1024';
}

interface OpenAIImageResponse {
  data?: { b64_json?: string; url?: string }[];
}

/** Turn an OpenAI Images response into a PNG data-URL. Prefers inline base64; falls back to a URL. */
export function parseOpenAIResponse(json: unknown): string {
  const first = (json as OpenAIImageResponse)?.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  throw new Error('No image in OpenAI response');
}

export const openaiProvider: ImageProvider = async (params: ImageGenParams, opts: ImageGenOpts) => {
  const body = {
    model: params.model || 'gpt-image-1',
    prompt: params.prompt,
    n: 1,
    size: nearestOpenAISize(params.width, params.height),
  };
  const res = await desktopFetch({
    url: `${trimUrl(opts.endpointUrl)}/v1/images/generations`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(opts.apiToken, 'Bearer') },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseOpenAIResponse(JSON.parse(res.body));
};
