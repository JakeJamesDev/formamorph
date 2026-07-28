// One place that turns the user's image-endpoint settings plus a subject's own prompt into a provider
// request. Both callers — the editor's Generate dialog and the in-game scene image — went through the same
// twenty lines of field-mapping before this, and had already drifted apart on how the preset's prompt
// prefixes are applied.

import type { ImageGenOpts, ImageGenParams, ImageProviderId } from './types';
import { resolveImageEndpoint } from './index';

/** The image-endpoint preset fields a request is built from (a subset of the settings context). */
export interface ImageSettings {
  imageProvider: ImageProviderId;
  imageEndpoint: string;
  imageApiToken: string;
  imageModel: string;
  /** Prepended to every prompt (quality/style tags the user owns). */
  imagePositivePrompt: string;
  /** Prepended to every negative prompt. */
  imageNegativePrompt: string;
  imageSteps: number;
  imageCfg: number;
  imageSampler: string;
  imageAdetailer: boolean;
  imageWorkflow: string;
  imageInvokeEncoder: string;
  imageInvokeVae: string;
  imageInvokeBoard: string;
}

/** What this particular subject contributes: its own prompt, and the size it wants. */
export interface ImageRequest {
  prompt: string;
  /** The subject's own negative terms, on top of the preset's. */
  negative?: string;
  width: number;
  height: number;
  /** -1 (the default) asks the provider for a random one. */
  seed?: number;
}

/** Join a preset prefix onto a subject's own line. A trailing comma on either side would otherwise double
 *  up — the prefixes are free text and people end them however they like. */
const joinPrompt = (prefix: string, own: string) =>
  [prefix.trim().replace(/,+$/, ''), own.trim().replace(/,+$/, '')].filter(Boolean).join(', ');

/**
 * Build the provider call for `req` under the user's settings. Returns the pieces `generateImage` takes;
 * the caller adds its own `signal`/`onProgress`, which are per-call rather than per-config.
 */
export function buildImageRequest(
  settings: ImageSettings,
  req: ImageRequest,
): { provider: ImageProviderId; params: ImageGenParams; opts: Omit<ImageGenOpts, 'signal' | 'onProgress'> } {
  return {
    provider: settings.imageProvider,
    params: {
      prompt: joinPrompt(settings.imagePositivePrompt, req.prompt),
      negativePrompt: joinPrompt(settings.imageNegativePrompt, req.negative ?? ''),
      width: req.width,
      height: req.height,
      steps: settings.imageSteps,
      cfg: settings.imageCfg,
      sampler: settings.imageSampler,
      seed: req.seed ?? -1,
      model: settings.imageModel,
      adetailer: settings.imageAdetailer,
    },
    opts: {
      endpointUrl: resolveImageEndpoint(settings.imageProvider, settings.imageEndpoint),
      apiToken: settings.imageApiToken,
      workflow: settings.imageWorkflow,
      invokeEncoder: settings.imageInvokeEncoder,
      invokeVae: settings.imageInvokeVae,
      invokeBoard: settings.imageInvokeBoard,
    },
  };
}
