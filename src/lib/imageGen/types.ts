// Shared shape for AI image generation. `ImageGenParams` is the lowest-common-denominator request
// (the A1111 txt2img field set) that every provider normalizes toward; providers drop what they can't map.

export type ImageProviderId = 'a1111' | 'openai' | 'comfyui';

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
  adetailer?: boolean; // A1111 only: enable the ADetailer face/hand-fix pass
}

/** Progress update during generation. `progress` is 0..1; `preview` is a live-frame data-URL. */
export interface ImageProgress {
  progress: number;
  preview?: string;
}

export interface ImageGenOpts {
  endpointUrl: string;
  apiToken: string;
  signal?: AbortSignal;
  onProgress?: (p: ImageProgress) => void; // A1111 + ComfyUI emit; OpenAI ignores it
  workflow?: string; // ComfyUI only: the API-format workflow template with %tokens%
}

/** Generate one image, returning a `data:image/...;base64,...` URL. Throws on failure (caller ignores AbortError). */
export type ImageProvider = (params: ImageGenParams, opts: ImageGenOpts) => Promise<string>;
