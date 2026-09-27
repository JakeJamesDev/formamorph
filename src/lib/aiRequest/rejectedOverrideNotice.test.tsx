import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'react-toastify';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { closeErrorDetails } from '@/lib/errorDetails';
import { AiStreamError } from './aiStream';
import type { AiRequestSpec } from './aiRequestSpec';
import { surfaceRejectedEndpointOverride } from './rejectedOverrideNotice';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';

vi.mock('@/components/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { ThemedToastContainer } from '@/components/ThemedToastContainer';

const spec: AiRequestSpec = {
  url: 'https://example.test/v1/chat/completions', headers: {},
  body: { model: 'test-model', messages: [{ role: 'user', content: 'Continue.' }], stream: true, top_p: 0.83 },
  target: {
    endpointId: 'rejected', url: 'https://example.test/v1/chat/completions', apiToken: '', model: 'test-model',
    maxTokens: 512, localEngine: false, samplerOverrides: defaultEndpointSamplerOverrides(), reasoning: UNKNOWN_REASONING_CAPABILITY,
  },
  requestType: 'narration', samplerSources: { topP: 'endpoint' },
};

afterEach(() => act(() => {
  toast.dismiss();
  closeErrorDetails();
}));

describe('surfaceRejectedEndpointOverride', () => {
  it('names the server rejection and disabled override, with a View Details link to the stream error', async () => {
    const disable = vi.fn();
    const error = new AiStreamError('http', 'HTTP 400', {
      status: 400,
      response: new Response(),
      serverError: { message: 'top_p is not supported', parameter: 'top_p' },
      details: 'Status: 400\n{"error":{"message":"top_p is not supported","param":"top_p"}}',
    });
    render(<ThemedToastContainer />);

    act(() => { expect(surfaceRejectedEndpointOverride(error, spec, 'Rejected', disable)).toBe('topP'); });
    expect(disable).toHaveBeenCalledWith('rejected', 'topP');
    await screen.findByText('top_p is not supported');
    expect(screen.getByText('Top P override disabled for Rejected.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View Details →' }));
    const dialog = await screen.findByRole('dialog', { name: 'Error Details' });
    expect(dialog.textContent).toContain('{"error":{"message":"top_p is not supported","param":"top_p"}}');
  });
});
