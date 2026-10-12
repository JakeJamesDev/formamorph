import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { ThemedToastContainer } from '@/components/ThemedToastContainer';
import { closeErrorDetails } from '@/lib/errorDetails';
import { generateImage, type ImageProviderId } from './index';
import { ImageConnectionError, reachFetch } from './http';
import { closeImageSetupGuide, toastImageFailure } from './failureToast';
import { invokeConnectionMessage } from './invokeai';

const params = {
  prompt: 'a dock at dusk', negativePrompt: '', width: 512, height: 512, steps: 20, cfg: 7,
  sampler: 'Euler a', seed: 1, model: 'My SDXL',
};
const ENDPOINT = 'http://127.0.0.1:9000';

/** Every request fails the way a browser reports an off server, a wrong URL or a CORS block. */
function stubUnreachable() {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
  vi.stubGlobal('WebSocket', class { constructor() { throw new Error('no socket'); } });
}

async function failure(provider: ImageProviderId, endpointUrl = ENDPOINT): Promise<unknown> {
  try {
    await generateImage(provider, params, { endpointUrl, apiToken: '' });
  } catch (error) {
    return error;
  }
  throw new Error(`${provider} did not fail`);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => {
    toast.dismiss();
    closeErrorDetails();
    closeImageSetupGuide();
  });
});

const browserCases: { provider: ImageProviderId; message: string }[] = [
  {
    provider: 'comfyui',
    message: `Couldn't reach ComfyUI at ${ENDPOINT}. Check that it's running, the URL is right, and it started with --enable-cors-header.`,
  },
  {
    provider: 'a1111',
    message: `Couldn't reach Automatic1111 at ${ENDPOINT}. Check that it's running, the URL is right, and it started with --api and --cors-allow-origins.`,
  },
  {
    provider: 'invokeai',
    message: `Couldn't reach InvokeAI at ${ENDPOINT}. Check that it's running, the URL is right, and the app's origin is in its allow_origins.`,
  },
  { provider: 'novelai', message: "Couldn't reach NovelAI. Check your internet connection." },
];

describe.each(browserCases)('$provider with no response', ({ provider, message }) => {
  it('names the server and the checks, and keeps the browser error in the details', async () => {
    stubUnreachable();
    const error = await failure(provider);

    expect(error).toBeInstanceOf(ImageConnectionError);
    expect((error as ImageConnectionError).provider).toBe(provider);
    expect((error as ImageConnectionError).message).toBe(message);
    expect((error as ImageConnectionError).details).toContain('No response: TypeError: Failed to fetch');
    expect((error as ImageConnectionError).details).toContain(`Request: `);
  });
});

describe('the desktop app', () => {
  it('leaves out the CORS step, because the app adds the headers itself', async () => {
    stubUnreachable();
    vi.stubGlobal('formamorphDesktop', { fetch: vi.fn() });
    const error = await failure('comfyui');

    expect((error as Error).message).toBe(`Couldn't reach ComfyUI at ${ENDPOINT}. Check that it's running and the URL is right.`);
  });

  it('turns a bridge request with no response into a connection error for the OpenAI provider', async () => {
    const bridgeError = new Error("Error invoking remote method 'net-fetch': Error: net::ERR_CONNECTION_REFUSED");
    vi.stubGlobal('formamorphDesktop', { fetch: vi.fn(async () => { throw bridgeError; }) });
    const error = await failure('openai', 'https://images.example');

    expect(error).toBeInstanceOf(ImageConnectionError);
    expect((error as Error).message).toBe("Couldn't reach https://images.example. Check the URL and your internet connection.");
    expect((error as ImageConnectionError).cause).toBe(bridgeError);
  });

  it('keeps any other bridge error as it is', async () => {
    const bridgeError = new Error("net-fetch: unsupported URL scheme 'file:'");
    vi.stubGlobal('formamorphDesktop', { fetch: vi.fn(async () => { throw bridgeError; }) });

    expect(await failure('openai', 'https://images.example')).toBe(bridgeError);
  });
});

describe('reachFetch', () => {
  it('lets an abort through unchanged', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn(async () => { throw abort; }));

    await expect(reachFetch('comfyui', ENDPOINT, `${ENDPOINT}/prompt`)).rejects.toBe(abort);
  });

  it('masks a key in the URL in the details', async () => {
    stubUnreachable();
    const error = await reachFetch('a1111', ENDPOINT, `${ENDPOINT}/x?api_key=sk-secret`, { method: 'POST' })
      .then(() => { throw new Error('reachFetch did not fail'); }, (e: unknown) => e as ImageConnectionError);

    expect(error.details).toContain('Request: POST');
    expect(error.details).not.toContain('sk-secret');
  });
});

describe('a TypeError after the server answered', () => {
  it('keeps its own text, because the connection worked', async () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'prompt_id')");
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw bug; } } as unknown as Response)));
    vi.stubGlobal('WebSocket', class { constructor() { throw new Error('no socket'); } });

    expect(await failure('comfyui')).toBe(bug);
  });
});

describe('the ComfyUI history poll', () => {
  it('rides out a dropped connection and still returns the image', async () => {
    vi.useFakeTimers();
    let historyCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/prompt')) return new Response(JSON.stringify({ prompt_id: 'p1' }));
      if (url.includes('/history/p1')) {
        historyCalls += 1;
        if (historyCalls === 1) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify({ p1: { outputs: { '9': { images: [{ filename: 'o.png', subfolder: '', type: 'output' }] } } } }));
      }
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
    }));
    vi.stubGlobal('WebSocket', class { constructor() { throw new Error('no socket'); } });

    const run = generateImage('comfyui', params, { endpointUrl: ENDPOINT, apiToken: '' });
    await vi.advanceTimersByTimeAsync(5000);

    await expect(run).resolves.toMatch(/^data:image\/png;base64,/);
    expect(historyCalls).toBe(2);
  });

  it('gives up after repeated dropped connections', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/prompt')) return new Response(JSON.stringify({ prompt_id: 'p1' }));
      throw new TypeError('Failed to fetch');
    }));
    vi.stubGlobal('WebSocket', class { constructor() { throw new Error('no socket'); } });

    const run = generateImage('comfyui', params, { endpointUrl: ENDPOINT, apiToken: '' }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(((await run) as Error).message).toBe('ComfyUI stopped responding while generating.');
  });
});

describe('the Settings InvokeAI message', () => {
  it('keeps the pointer to How to Set Up', () => {
    expect(invokeConnectionMessage(new TypeError('Failed to fetch'), ENDPOINT)).toBe(
      `Couldn't reach InvokeAI at ${ENDPOINT}. Check that it's running, the URL is right, and the app's origin is in its allow_origins (Settings → How to Set Up).`,
    );
  });
});

describe('toastImageFailure', () => {
  it('offers Fix connection, which opens the setup guide for that provider', async () => {
    stubUnreachable();
    const error = await failure('comfyui');
    render(<ThemedToastContainer />);
    act(() => toastImageFailure(error, 'Image generation failed.'));

    await screen.findByText((error as Error).message);
    expect(screen.queryByRole('button', { name: 'View Details →' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fix connection →' }));
    await screen.findByRole('dialog', { name: 'Set up ComfyUI' });
  });

  it('offers View Details for any other failure', async () => {
    render(<ThemedToastContainer />);
    act(() => toastImageFailure(new Error('HTTP 500'), 'Image generation failed.'));

    await screen.findByText('HTTP 500');
    expect(screen.getByRole('button', { name: 'View Details →' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fix connection →' })).toBeNull();
  });
});
