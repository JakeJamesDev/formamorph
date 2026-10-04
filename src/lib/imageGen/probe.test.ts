// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { imageProbeSupported, imageReachabilityTarget, probeImageEndpoint, type ImagePresetSettings } from './probe';

const desktopFetch = vi.fn<(req: { url: string; method?: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; body: string }>>();
let desktop = false;
vi.mock('./desktop', () => ({
  isDesktop: () => desktop,
  desktopFetch: (req: { url: string }) => desktopFetch(req),
}));

/** Stand in for fetch, answering per-URL. A url absent from `routes` behaves like a dead server. */
function mockFetch(routes: Record<string, { ok?: boolean; body?: unknown }>) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const route = routes[url];
    if (!route) throw new Error('connection refused');
    return { ok: route.ok ?? true, status: route.ok === false ? 500 : 200, json: async () => route.body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  desktopFetch.mockReset();
  desktop = false;
});

describe('probeImageEndpoint: ComfyUI', () => {
  const NODE = 'http://localhost:8188/object_info/KSampler';

  it('is ok when its node info answers', async () => {
    const fetchMock = mockFetch({ [NODE]: { body: { KSampler: {} } } });
    expect(await probeImageEndpoint('comfyui', 'http://localhost:8188/', '', 'any.safetensors')).toBe('ok');
    expect(fetchMock.mock.calls[0][1]?.method ?? 'GET').toBe('GET');
  });

  it('is unreachable when the server is down or refuses', async () => {
    mockFetch({});
    expect(await probeImageEndpoint('comfyui', 'http://localhost:8188', '', '')).toBe('unreachable');
    mockFetch({ [NODE]: { ok: false } });
    expect(await probeImageEndpoint('comfyui', 'http://localhost:8188', '', '')).toBe('unreachable');
  });
});

describe('probeImageEndpoint: InvokeAI', () => {
  const MODELS = 'http://localhost:9090/api/v2/models/';
  const list = {
    models: [
      { key: 'k-1', name: 'Juggernaut XL', base: 'sdxl', type: 'main' },
      { key: 'k-2', name: 'sdxl-vae-fp16', base: 'sdxl', type: 'vae' },
      { key: 'k-3', name: 'FLUX.1 dev', base: 'flux', type: 'main' },
    ],
  };

  it('is ok when the configured model is installed, by name or key', async () => {
    mockFetch({ [MODELS]: { body: list } });
    expect(await probeImageEndpoint('invokeai', 'http://localhost:9090', '', 'juggernaut xl')).toBe('ok');
    expect(await probeImageEndpoint('invokeai', 'http://localhost:9090', '', 'k-1')).toBe('ok');
  });

  it('reports unknownModel when the configured model is absent', async () => {
    mockFetch({ [MODELS]: { body: list } });
    expect(await probeImageEndpoint('invokeai', 'http://localhost:9090', '', 'Pony V6')).toBe('unknownModel');
  });

  // Generation refuses each of these, so the badge must not call them reachable.
  it('reports unknownModel for a blank model, a non-main model, or an unsupported base', async () => {
    mockFetch({ [MODELS]: { body: list } });
    for (const model of ['', '  ', 'sdxl-vae-fp16', 'FLUX.1 dev']) {
      expect(await probeImageEndpoint('invokeai', 'http://localhost:9090', '', model)).toBe('unknownModel');
    }
  });

  it('sends the token as a Bearer header', async () => {
    const fetchMock = mockFetch({ [MODELS]: { body: list } });
    await probeImageEndpoint('invokeai', 'http://localhost:9090', 'sekrit', 'k-1');
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer sekrit' });
  });

  it('is unreachable when the list request fails', async () => {
    mockFetch({ [MODELS]: { ok: false } });
    expect(await probeImageEndpoint('invokeai', 'http://localhost:9090', '', 'k-1')).toBe('unreachable');
  });
});

describe('probeImageEndpoint: A1111', () => {
  const MODELS = 'http://localhost:7860/sdapi/v1/sd-models';
  // The shape /sdapi/v1/sd-models returns for a checkpoint in a subfolder.
  const list = [{
    title: 'xl/ponyDiffusionV6XL.safetensors [67ab2fd8ec]',
    model_name: 'xl_ponyDiffusionV6XL',
    hash: '67ab2fd8ec',
    sha256: '67ab2fd8ec439a89b3fedb15cc65f54336af163c7eb5e4f2acc98f090a29b0b3',
    filename: 'C:\\sd\\models\\Stable-diffusion\\xl\\ponyDiffusionV6XL.safetensors',
  }];

  it('is ok for any name A1111 resolves: an alias, a hash, or a part of the title', async () => {
    mockFetch({ [MODELS]: { body: list } });
    for (const model of [
      'xl/ponyDiffusionV6XL.safetensors [67ab2fd8ec]', 'xl_ponyDiffusionV6XL', '67ab2fd8ec', list[0].sha256,
      'ponyDiffusionV6XL.safetensors', 'ponyDiffusionV6XL', 'ponyDiffusionV6XL [00000000]',
    ]) {
      expect(await probeImageEndpoint('a1111', 'http://localhost:7860', '', model)).toBe('ok');
    }
  });

  // A1111 compares names case-sensitively, so a wrong-case name fails there too.
  it('reports unknownModel for a name in the wrong case', async () => {
    mockFetch({ [MODELS]: { body: list } });
    expect(await probeImageEndpoint('a1111', 'http://localhost:7860', '', 'ponydiffusionv6xl')).toBe('unknownModel');
  });

  it('is ok with no model, which keeps the loaded checkpoint', async () => {
    mockFetch({ [MODELS]: { body: list } });
    expect(await probeImageEndpoint('a1111', 'http://localhost:7860', '', '')).toBe('ok');
  });

  it('reports unknownModel when the checkpoint is absent', async () => {
    mockFetch({ [MODELS]: { body: list } });
    expect(await probeImageEndpoint('a1111', 'http://localhost:7860', '', 'sdxl_base_1.0')).toBe('unknownModel');
  });

  it('sends the token as a Basic header, like generation', async () => {
    const fetchMock = mockFetch({ [MODELS]: { body: list } });
    await probeImageEndpoint('a1111', 'http://localhost:7860', 'user:pass', '');
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Basic user:pass' });
  });

  it('is unreachable when the server is down', async () => {
    mockFetch({});
    expect(await probeImageEndpoint('a1111', 'http://localhost:7860', '', '')).toBe('unreachable');
  });
});

describe('probeImageEndpoint: OpenAI', () => {
  const MODELS = 'https://api.example.test/v1/models';
  const list = JSON.stringify({ data: [{ id: 'gpt-image-1' }, { id: 'dall-e-3' }] });

  it('reads the model list through the desktop bridge, never through fetch', async () => {
    desktop = true;
    const fetchMock = mockFetch({});
    desktopFetch.mockResolvedValue({ ok: true, status: 200, body: list });
    expect(await probeImageEndpoint('openai', 'https://api.example.test/', 'sk-x', 'dall-e-3')).toBe('ok');
    expect(desktopFetch).toHaveBeenCalledWith({ url: MODELS, method: 'GET', headers: { Authorization: 'Bearer sk-x' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the default model when none is configured', async () => {
    desktop = true;
    desktopFetch.mockResolvedValue({ ok: true, status: 200, body: JSON.stringify({ data: [{ id: 'dall-e-3' }] }) });
    expect(await probeImageEndpoint('openai', 'https://api.example.test', '', '')).toBe('unknownModel');
  });

  it('reports unknownModel when the configured model is absent', async () => {
    desktop = true;
    desktopFetch.mockResolvedValue({ ok: true, status: 200, body: list });
    expect(await probeImageEndpoint('openai', 'https://api.example.test', '', 'flux-pro')).toBe('unknownModel');
  });

  it('is ok when the gateway lists no models, since absence proves nothing', async () => {
    desktop = true;
    desktopFetch.mockResolvedValue({ ok: true, status: 200, body: JSON.stringify({ data: [] }) });
    expect(await probeImageEndpoint('openai', 'https://api.example.test', '', 'flux-pro')).toBe('ok');
  });

  it('is unreachable when the bridge refuses or the list fails', async () => {
    desktop = true;
    desktopFetch.mockResolvedValue({ ok: false, status: 401, body: '' });
    expect(await probeImageEndpoint('openai', 'https://api.example.test', '', '')).toBe('unreachable');
    desktopFetch.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));
    expect(await probeImageEndpoint('openai', 'https://api.example.test', '', '')).toBe('unreachable');
  });
});

/** The settings `imageReachabilityTarget` reads, for one preset. */
const preset = (p: Partial<ImagePresetSettings>): ImagePresetSettings => ({
  imageProvider: 'comfyui', imageEndpoint: '', imageApiToken: '', imageModel: '', imageGenDisabled: false, ...p,
});

describe('disabled providers', () => {
  it('sends nothing for NovelAI, on web or desktop', async () => {
    const fetchMock = mockFetch({});
    for (const d of [false, true]) {
      desktop = d;
      expect(await probeImageEndpoint('novelai', 'https://image.novelai.net', 'pst', 'nai-diffusion-4-5-full')).toBe('unreachable');
      expect(imageProbeSupported('novelai')).toBe(false);
      expect(imageReachabilityTarget(preset({ imageProvider: 'novelai', imageApiToken: 'pst' })).enabled).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(desktopFetch).not.toHaveBeenCalled();
  });

  it('sends nothing for OpenAI in the web build, and enables it on desktop', async () => {
    const fetchMock = mockFetch({});
    const openai = preset({ imageProvider: 'openai', imageEndpoint: 'https://api.example.test' });
    expect(await probeImageEndpoint('openai', 'https://api.example.test', 'sk-x', '')).toBe('unreachable');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(desktopFetch).not.toHaveBeenCalled();
    expect(imageProbeSupported('openai')).toBe(false);
    expect(imageReachabilityTarget(openai).enabled).toBe(false);
    desktop = true;
    expect(imageProbeSupported('openai')).toBe(true);
    expect(imageReachabilityTarget(openai).enabled).toBe(true);
  });
});

describe('imageReachabilityTarget', () => {
  it('resolves a blank endpoint to the provider default and keys the probe on the provider', () => {
    expect(imageReachabilityTarget(preset({ imageEndpoint: ' ', imageModel: 'm' })))
      .toEqual({ provider: 'comfyui', url: 'http://localhost:8188', apiToken: '', model: 'm', enabled: true });
  });

  it('names the default OpenAI model so the badge says which model is missing', () => {
    desktop = true;
    expect(imageReachabilityTarget(preset({ imageProvider: 'openai', imageEndpoint: 'https://x.test' })).model)
      .toBe('gpt-image-1');
  });

  it('probes nothing while image generation is turned off', () => {
    expect(imageReachabilityTarget(preset({ imageGenDisabled: true })).enabled).toBe(false);
  });
});
