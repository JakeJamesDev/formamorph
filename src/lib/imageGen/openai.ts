// OpenAI-compatible Images provider. Cloud key APIs can't be called from a browser (CORS + key
// exposure), so this always routes through the Electron desktop bridge (net-fetch in the main process).
import type { ImageGenOpts, ImageGenParams, ImageProvider } from './types';
import { desktopFetch } from './desktop';
import { trimUrl, authHeaders, abortable, refusalDetails, imageConnectionError } from './http';
import { DetailedError } from '../errorDetails';

/** True when the desktop bridge's request got no response. IPC rethrows main-process errors as plain
 *  Errors, so only the text tells a network failure apart: Chromium `net::ERR_*` codes or undici's "fetch failed". */
const isBridgeNetworkError = (error: unknown): boolean =>
  error instanceof Error && /net::ERR_|fetch failed/i.test(error.message);

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

/** The model sent when the preset names none. */
export const OPENAI_DEFAULT_MODEL = 'gpt-image-1';

export const openaiProvider: ImageProvider = async (params: ImageGenParams, opts: ImageGenOpts) => {
  const body = {
    model: params.model || OPENAI_DEFAULT_MODEL,
    prompt: params.prompt,
    n: 1,
    size: nearestOpenAISize(params.width, params.height),
  };
  // The IPC bridge takes no AbortSignal, so Cancel unblocks the UI while the request finishes unseen —
  // a cloud generation can't be interrupted server-side anyway.
  const url = `${trimUrl(opts.endpointUrl)}/v1/images/generations`;
  const res = await abortable(desktopFetch({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(opts.apiToken, 'Bearer') },
    body: JSON.stringify(body),
  }), opts.signal).catch((error: unknown) => {
    if (isBridgeNetworkError(error)) throw imageConnectionError('openai', opts.endpointUrl, 'POST', url, error);
    throw error;
  });
  if (!res.ok) throw new DetailedError(`HTTP ${res.status}`, refusalDetails('POST', url, res, res.body));
  return parseOpenAIResponse(JSON.parse(res.body));
};
