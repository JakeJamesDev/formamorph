import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useEndpointReachable, type EndpointReachable } from '@/lib/useEndpointReachable';
import { EndpointReachabilityBadge } from './EndpointReachabilityBadge';

vi.mock('@/lib/useEndpointReachable', () => ({ useEndpointReachable: vi.fn() }));

const target = { url: 'http://llama.test/v1', apiToken: '', model: 'gemma', enabled: true };
const reachable = (state: Omit<EndpointReachable, 'recheck'>, recheck = vi.fn()) =>
  vi.mocked(useEndpointReachable).mockReturnValue({ ...state, recheck });

describe('EndpointReachabilityBadge', () => {
  it.each([
    [{ status: null, checking: true }, 'Checking…'],
    [{ status: 'ok', checking: false }, 'Reachable'],
    [{ status: 'unknownModel', checking: false }, 'Reachable, but no "gemma"'],
    [{ status: 'unreachable', checking: false }, "Didn't answer"],
    [{ status: null, checking: false }, 'Not checked'],
  ] as const)('shows %o as "%s"', (state, text) => {
    reachable(state);
    render(<EndpointReachabilityBadge target={target} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('says "no model" rather than quoting an empty name when the preset names none', () => {
    reachable({ status: 'unknownModel', checking: false });
    render(<EndpointReachabilityBadge target={{ ...target, model: ' ' }} />);
    expect(screen.getByText('Reachable, but no model')).toBeInTheDocument();
  });

  it('probes the endpoint it is given', () => {
    reachable({ status: 'ok', checking: false });
    render(<EndpointReachabilityBadge target={target} />);
    expect(useEndpointReachable).toHaveBeenLastCalledWith('http://llama.test/v1', '', 'gemma', true, 'text');
  });

  it('probes an image target with its provider', () => {
    reachable({ status: 'ok', checking: false });
    render(<EndpointReachabilityBadge target={{ ...target, provider: 'invokeai' }} />);
    expect(useEndpointReachable).toHaveBeenLastCalledWith('http://llama.test/v1', '', 'gemma', true, 'invokeai');
  });

  it('draws nothing for a disabled target', () => {
    reachable({ status: null, checking: false });
    const { container } = render(<EndpointReachabilityBadge target={{ ...target, enabled: false }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('rechecks on Recheck, and locks Recheck while a check runs', () => {
    const recheck = vi.fn();
    reachable({ status: 'unreachable', checking: false }, recheck);
    const { rerender } = render(<EndpointReachabilityBadge target={target} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recheck' }));
    expect(recheck).toHaveBeenCalledOnce();

    reachable({ status: null, checking: true }, recheck);
    rerender(<EndpointReachabilityBadge target={target} />);
    expect(screen.getByRole('button', { name: 'Recheck' })).toBeDisabled();
  });
});
