// Shared shape for AI image generation. `ImageGenParams` is the lowest-common-denominator request
// (the A1111 txt2img field set) that every provider normalizes toward; providers drop what they can't map.

export type ImageProviderId = 'a1111' | 'openai';

export interface ImageGenParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  sampler: string;
  seed: number; // -1 = random
  model: string; // provider-specific; '' means "server default"
}

export interface ImageGenOpts {
  endpointUrl: string;
  apiToken: string;
  signal?: AbortSignal;
}

/** Generate one image, returning a `data:image/...;base64,...` URL. Throws on failure (caller ignores AbortError). */
export type ImageProvider = (params: ImageGenParams, opts: ImageGenOpts) => Promise<string>;
