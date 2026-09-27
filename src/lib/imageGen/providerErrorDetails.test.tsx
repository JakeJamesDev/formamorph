import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { ThemedToastContainer } from '@/components/ThemedToastContainer';
import { closeErrorDetails } from '@/lib/errorDetails';
import { toastError } from '@/lib/linkToast';
import { generateImage, type ImageProviderId } from './index';
import { fetchInvokeModels, InvokeHttpError } from './invokeai';
import type { DesktopFetchRequest } from './desktop';

const params = {
  prompt: 'a dock at dusk', negativePrompt: '', width: 512, height: 512, steps: 20, cfg: 7,
  sampler: 'Euler a', seed: 1, model: 'My SDXL',
};
const sdxl = { key: 'k-sdxl', hash: 'blake3:aa', name: 'My SDXL', base: 'sdxl', type: 'main' };

const A1111_BODY = '{"detail":"Sampler not found: Euler z"}';
const OPENAI_BODY = '{"error":{"message":"Invalid size 700x700","param":"size"}}';
const INVOKE_BODY = '{"detail":[{"loc":["body","batch","graph"],"msg":"cfg_scale must be <= 200"}]}';

/** Answers every request through fetch and the desktop bridge with this failure, except InvokeAI's model list. */
function stubRefusal(status: number, statusText: string, body: string) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/api/v2/models/')) return new Response(JSON.stringify({ models: [sdxl] }));
    return new Response(body, { status, statusText });
  });
  vi.stubGlobal('fetch', fetchMock);
  // A throwing socket leaves InvokeAI on its queue poll, with no connection opened.
  vi.stubGlobal('WebSocket', class { constructor() { throw new Error('no socket'); } });
  const desktop = vi.fn(async (_req: DesktopFetchRequest) => ({ ok: false, status, body }));
  vi.stubGlobal('formamorphDesktop', { fetch: desktop });
  return { fetchMock, desktop };
}

async function failure(provider: ImageProviderId, endpointUrl = 'http://127.0.0.1:9000'): Promise<Error & { details?: string }> {
  try {
    await generateImage(provider, params, { endpointUrl, apiToken: 'sk-header-token' });
  } catch (error) {
    return error as Error & { details?: string };
  }
  throw new Error(`${provider} did not fail`);
}

const cases: { provider: ImageProviderId; status: number; statusText: string; body: string; message: string; statusLine: string }[] = [
  {
    provider: 'a1111', status: 422, statusText: 'Unprocessable Entity', body: A1111_BODY,
    message: 'HTTP 422', statusLine: 'Status: 422 Unprocessable Entity',
  },
  { provider: 'openai', status: 400, statusText: '', body: OPENAI_BODY, message: 'HTTP 400', statusLine: 'Status: 400' },
  {
    provider: 'invokeai', status: 422, statusText: 'Unprocessable Entity', body: INVOKE_BODY,
    message: 'InvokeAI rejected the batch: [{"loc":["body","batch","graph"],"msg":"cfg_scale must be <= 200"}]',
    statusLine: 'Status: 422 Unprocessable Entity',
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => {
    toast.dismiss();
    closeErrorDetails();
  });
});

describe.each(cases)('$provider refusal', ({ provider, status, statusText, body, message, statusLine }) => {
  it('keeps its short message and puts the status and the body in the details', async () => {
    stubRefusal(status, statusText, body);
    const error = await failure(provider);

    expect(error.message).toBe(message);
    expect(error.details).toContain(statusLine);
    expect(error.details).toContain(`Response:\n${body}`);
  });

  it('masks a key in the endpoint query string and never shows the header token', async () => {
    stubRefusal(status, statusText, body);
    const { details } = await failure(provider, 'http://127.0.0.1:9000?api_key=sk-query-secret');

    expect(details).toContain('api_key=[redacted]');
    expect(details).not.toContain('sk-query-secret');
    expect(details).not.toContain('sk-header-token');
  });

  it('offers View Details on the generate-image toast, and the window shows the body', async () => {
    stubRefusal(status, statusText, body);
    const error = await failure(provider);
    render(<ThemedToastContainer />);
    act(() => toastError(error, 'Image generation failed.'));

    await screen.findByText(message);
    fireEvent.click(screen.getByRole('button', { name: 'View Details →' }));
    const dialog = await screen.findByRole('dialog', { name: 'Error Details' });
    expect(dialog.textContent).toContain(body);
  });
});

describe('InvokeAI image fetch refusal', () => {
  it('puts the status and the body in the details after the render completes', async () => {
    const completed = { status: 'completed', session: { results: { r: { type: 'image_output', image: { image_name: 'out.png' } } } } };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/v2/models/')) return new Response(JSON.stringify({ models: [sdxl] }));
      if (url.endsWith('/enqueue_batch')) return new Response(JSON.stringify({ item_ids: [7] }));
      if (url.includes('/queue/default/i/7')) return new Response(JSON.stringify(completed));
      return new Response('{"detail":"Image out.png not found"}', { status: 404, statusText: 'Not Found' });
    }));
    vi.stubGlobal('WebSocket', class { constructor() { throw new Error('no socket'); } });
    const error = await failure('invokeai');

    expect(error.message).toBe('Failed to fetch image: HTTP 404');
    expect(error.details).toContain('Status: 404 Not Found');
    expect(error.details).toContain('Response:\n{"detail":"Image out.png not found"}');
  });
});

describe('InvokeAI model list refusal', () => {
  it('stays an InvokeHttpError and carries the status and the body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"detail":"Invalid token"}', { status: 401, statusText: 'Unauthorized' })));
    const error = await fetchInvokeModels('http://127.0.0.1:9090', 'bad').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvokeHttpError);
    expect((error as InvokeHttpError).status).toBe(401);
    expect((error as InvokeHttpError).details).toContain('Status: 401 Unauthorized');
    expect((error as InvokeHttpError).details).toContain('Response:\n{"detail":"Invalid token"}');
  });

  it('keeps the token advice as the message and the body in the details when generation hits it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"detail":"Invalid token"}', { status: 401 })));
    const error = await failure('invokeai');

    expect(error.message).toBe('InvokeAI rejected the request (HTTP 401). Check the API Token in Settings → Endpoints → Image.');
    expect(error.details).toContain('Response:\n{"detail":"Invalid token"}');
  });
});
