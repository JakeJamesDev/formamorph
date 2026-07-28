import { describe, it, expect } from 'vitest';
import { buildImageRequest, type ImageSettings } from './request';

const settings: ImageSettings = {
  imageProvider: 'a1111',
  imageEndpoint: '',
  imageApiToken: 'tok',
  imageModel: 'sdxl.safetensors',
  imagePositivePrompt: 'masterpiece, best quality',
  imageNegativePrompt: 'lowres, watermark',
  imageSteps: 25,
  imageCfg: 7,
  imageSampler: 'Euler a',
  imageAdetailer: true,
  imageWorkflow: '{}',
  imageInvokeEncoder: 'enc',
  imageInvokeVae: 'vae',
  imageInvokeBoard: 'board',
};

describe('buildImageRequest', () => {
  it('puts the preset prefixes in front of the subject\'s own lines', () => {
    const { params } = buildImageRequest(settings, { prompt: '1girl, dock', negative: 'blurry', width: 8, height: 4 });
    expect(params.prompt).toBe('masterpiece, best quality, 1girl, dock');
    expect(params.negativePrompt).toBe('lowres, watermark, blurry');
  });

  it('never doubles a comma, whichever side carries the trailing one', () => {
    const out = buildImageRequest(
      { ...settings, imagePositivePrompt: 'masterpiece, newest, ' },
      { prompt: '1girl, dock,', width: 8, height: 4 },
    );
    expect(out.params.prompt).toBe('masterpiece, newest, 1girl, dock');
    expect(out.params.prompt).not.toContain(',,');
  });

  it('omits an empty side rather than leaving a dangling separator', () => {
    const bare = buildImageRequest(
      { ...settings, imagePositivePrompt: '', imageNegativePrompt: '' },
      { prompt: '1girl', width: 8, height: 4 },
    );
    expect(bare.params.prompt).toBe('1girl');
    expect(bare.params.negativePrompt).toBe('');
    // A subject with nothing of its own still gets the preset's line.
    expect(buildImageRequest(settings, { prompt: '', width: 8, height: 4 }).params.prompt)
      .toBe('masterpiece, best quality');
  });

  it('carries the preset through to params and opts, with the size from the request', () => {
    const { provider, params, opts } = buildImageRequest(settings, { prompt: 'x', width: 1216, height: 832 });
    expect(provider).toBe('a1111');
    expect(params).toMatchObject({
      width: 1216, height: 832, steps: 25, cfg: 7, sampler: 'Euler a',
      model: 'sdxl.safetensors', adetailer: true, seed: -1,
    });
    expect(opts).toEqual({
      endpointUrl: 'http://127.0.0.1:7860', // blank endpoint → the provider default
      apiToken: 'tok',
      workflow: '{}',
      invokeEncoder: 'enc',
      invokeVae: 'vae',
      invokeBoard: 'board',
    });
  });

  it('passes an explicit seed through, so a caller can pin one', () => {
    expect(buildImageRequest(settings, { prompt: 'x', width: 8, height: 4, seed: 99 }).params.seed).toBe(99);
  });
});
