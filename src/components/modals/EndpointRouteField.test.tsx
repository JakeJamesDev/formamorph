import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEndpointReachable } from '@/lib/useEndpointReachable';
import { EndpointRouteField } from './EndpointRouteField';

vi.mock('@/lib/useEndpointReachable', () => ({ useEndpointReachable: vi.fn() }));
vi.mocked(useEndpointReachable).mockReturnValue({ status: 'ok', checking: false, recheck: vi.fn() });

const presets = [{ id: 'default', name: 'Default' }, { id: 'llama', name: 'Llama' }];
const target = { url: 'http://llama.test/v1', apiToken: '', model: 'gemma', enabled: false };

const renderField = (value: string | null, onChange = vi.fn()) => {
  render(
    <EndpointRouteField
      label="Endpoint"
      description="Where this request goes"
      info="Where it goes now"
      value={value}
      activeName="Default"
      presets={presets}
      onChange={onChange}
      target={{ ...target, enabled: value !== null }}
    />,
  );
  return onChange;
};

describe('EndpointRouteField', () => {
  it('pins a preset', async () => {
    const onChange = renderField(null);
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Llama' }));
    expect(onChange).toHaveBeenCalledWith('llama');
  });

  it('picks Follow Active as null', async () => {
    const onChange = renderField('llama');
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Use Active Endpoint (Default)' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('shows the badge only while pinned', () => {
    renderField(null);
    expect(screen.getByRole('combobox')).toHaveTextContent('Use Active Endpoint (Default)');
    expect(screen.queryByText('Reachable')).toBeNull();
  });

  it('shows the pinned preset and its badge', () => {
    renderField('llama');
    expect(screen.getByRole('combobox')).toHaveTextContent('Llama');
    expect(screen.getByText('Reachable')).toBeInTheDocument();
  });
});
