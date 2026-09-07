import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { AiStreamError } from './aiStream';
import type { AiRequestSpec } from './aiRequestSpec';
import { surfaceRejectedEndpointOverride } from './rejectedOverrideNotice';

const toastError = vi.hoisted(() => vi.fn());

vi.mock('react-toastify', () => ({ toast: { error: toastError } }));

const spec: AiRequestSpec = {
  url: 'https://example.test/v1/chat/completions', headers: {},
  body: { model: 'test-model', messages: [{ role: 'user', content: 'Continue.' }], stream: true, top_p: 0.83 },
  target: {
    endpointId: 'rejected', url: 'https://example.test/v1/chat/completions', apiToken: '', model: 'test-model',
    maxTokens: 512, localEngine: false, samplerOverrides: defaultEndpointSamplerOverrides(), supportedReasoningEfforts: null,
  },
  requestType: 'narration', samplerSources: { topP: 'endpoint' },
};

describe('surfaceRejectedEndpointOverride', () => {
  it('names the server rejection and disabled override in the player-visible toast', () => {
    const disable = vi.fn();
    const error = new AiStreamError('http', 'HTTP 400', {
      status: 400,
      response: new Response(),
      serverError: { message: 'top_p is not supported', parameter: 'top_p' },
    });

    expect(surfaceRejectedEndpointOverride(error, spec, 'Rejected', disable)).toBe('topP');
    expect(disable).toHaveBeenCalledWith('rejected', 'topP');
    render(toastError.mock.calls[0][0]);
    expect(screen.getByText('top_p is not supported')).toBeInTheDocument();
    expect(screen.getByText('Top P override disabled for Rejected.')).toBeInTheDocument();
  });
});
