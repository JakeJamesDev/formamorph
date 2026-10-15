import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { ThemedToastContainer } from '@/components/ThemedToastContainer';
import { closeErrorDetails } from '@/lib/errorDetails';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { AiRequestSpec } from './aiRequestSpec';
import { streamAiRequest } from './aiStream';
import { toastAiRequestFailure } from './aiRequestFailureToast';
import { rejectedEndpointOverride } from './rejectedOverride';
import { surfaceRejectedEndpointOverride } from './rejectedOverrideNotice';

const spec: AiRequestSpec = {
  url: 'https://example.test/v1/chat/completions',
  headers: { Authorization: 'Bearer token' },
  body: { model: 'test-model', messages: [{ role: 'user', content: 'Continue.' }], stream: true, top_p: 0.83 },
  target: {
    endpointId: 'rejected', url: 'https://example.test/v1/chat/completions', apiToken: 'token', model: 'test-model',
    maxTokens: 512, localEngine: false, samplerOverrides: defaultEndpointSamplerOverrides(), reasoning: UNKNOWN_REASONING_CAPABILITY,
  },
  requestType: 'narration', samplerSources: { topP: 'endpoint' },
};

/** The error the real stream throws when the endpoint answers with this response. */
async function streamFailure(respond: () => Promise<Response>): Promise<unknown> {
  const fetchImpl = (() => respond()) as unknown as typeof fetch;
  try {
    for await (const _event of streamAiRequest(spec, { fetchImpl })) { /* drain */ }
  } catch (error) {
    return error;
  }
  throw new Error('The stream did not fail');
}

const rejection = (status: number, error: Record<string, string>) =>
  streamFailure(async () => new Response(JSON.stringify({ error }), { status }));

afterEach(() => act(() => {
  toast.dismiss();
  closeErrorDetails();
}));

describe('toastAiRequestFailure', () => {
  it('names the prompt that failed and shows the server reason in Error Details', async () => {
    const error = await rejection(404, { message: 'model not found', code: 'model_not_found' });
    render(<ThemedToastContainer />);
    act(() => toastAiRequestFailure(error, vi.fn()));

    await screen.findByText('Narration failed');
    fireEvent.click(screen.getByRole('button', { name: 'View Details →' }));
    const dialog = await screen.findByRole('dialog', { name: 'Error Details' });
    expect(dialog.textContent).toContain('Message: model not found');
    expect(dialog.textContent).toContain('Status: 404');
    expect(dialog.textContent).toContain('Prompt: Narration');
  });

  it('names the endpoint beside the prompt when the request knows it', async () => {
    const error = Object.assign(new Error('HTTP 500'), { prompt: 'Location Change', endpoint: 'GLM 5.3' });
    render(<ThemedToastContainer />);
    act(() => toastAiRequestFailure(error, vi.fn()));
    await screen.findByText('Location Change failed (GLM 5.3)');
  });

  it('offers the connection guide, not Error Details, when the server is unreachable', async () => {
    const error = await streamFailure(() => Promise.reject(new TypeError('Failed to fetch')));
    const openGuide = vi.fn();
    render(<ThemedToastContainer />);
    act(() => toastAiRequestFailure(error, openGuide));

    fireEvent.click(await screen.findByRole('button', { name: 'Fix connection →' }));
    expect(openGuide).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'View Details →' })).toBeNull();
  });
});

describe('rejected endpoint override after a stream failure', () => {
  it('still disables the override and names the server reason', async () => {
    const error = await rejection(400, { message: 'top_p is not supported', param: 'top_p' });
    const disable = vi.fn();
    render(<ThemedToastContainer />);

    const override = rejectedEndpointOverride(error, spec);
    expect(override).toBe('topP');
    act(() => surfaceRejectedEndpointOverride({ kind: 'rejectedOverride', error, override: override!, endpointId: spec.target.endpointId, presetName: 'Rejected' }, disable));
    expect(disable).toHaveBeenCalledWith('rejected', 'topP');
    await screen.findByText('top_p is not supported');
    await screen.findByText('Top P override disabled for Rejected.');
  });
});
