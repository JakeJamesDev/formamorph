import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEndpointReachable } from '@/lib/useEndpointReachable';
import { EndpointRouteField } from './EndpointRouteField';

vi.mock('@/lib/useEndpointReachable', () => ({ useEndpointReachable: vi.fn() }));
vi.mocked(useEndpointReachable).mockReturnValue({ status: 'ok', checking: false, recheck: vi.fn() });

const presets = [{ id: 'default', name: 'Default' }, { id: 'llama', name: 'Llama' }];
const target = { url: 'http://llama.test/v1', apiToken: '', model: 'gemma', enabled: true };

const renderField = (value: string | null, onChange = vi.fn(), enabled = true) => {
  render(
    <EndpointRouteField
      label="Endpoint"
      description="Where this request goes"
      info="Where it goes now"
      value={value}
      activeName="Default"
      presets={presets}
      onChange={onChange}
      target={{ ...target, enabled }}
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

  it('shows Follow Active for a null value', () => {
    renderField(null);
    expect(screen.getByRole('combobox')).toHaveTextContent('Use Active Endpoint (Default)');
  });

  it('shows the pinned preset', () => {
    renderField('llama');
    expect(screen.getByRole('combobox')).toHaveTextContent('Llama');
  });

  it('probes the target it is given and shows its badge', () => {
    renderField('llama');
    expect(useEndpointReachable).toHaveBeenLastCalledWith('http://llama.test/v1', '', 'gemma', true, 'text');
    expect(screen.getByText('Reachable')).toBeInTheDocument();
  });

  it('draws no badge for a target that is off', () => {
    renderField('llama', vi.fn(), false);
    expect(screen.queryByText('Reachable')).toBeNull();
  });

  describe('with a row that names no preset', () => {
    const renderWithRow = (value: string | null, onChange = vi.fn()) => {
      render(
        <EndpointRouteField
          label="Search Endpoint"
          description="Where picks go"
          info="Where they go now"
          value={value}
          activeName="Default"
          extraRows={[{ value: 'same', label: 'Same as Answer (Llama)' }]}
          presets={presets}
          onChange={onChange}
          target={{ ...target, enabled: false }}
        />,
      );
      return onChange;
    };

    it('lists it first and passes its value', async () => {
      const onChange = renderWithRow(null);
      const user = userEvent.setup();
      await user.click(screen.getByRole('combobox'));
      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['Same as Answer (Llama)', 'Use Active Endpoint (Default)', 'Default', 'Llama']);
      await user.click(options[0]);
      expect(onChange).toHaveBeenCalledWith('same');
    });

    it('shows it for its value', () => {
      renderWithRow('same');
      expect(screen.getByRole('combobox')).toHaveTextContent('Same as Answer (Llama)');
    });
  });
});
