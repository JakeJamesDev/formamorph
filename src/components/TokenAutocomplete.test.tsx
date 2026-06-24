import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TokenAutocomplete } from './TokenAutocomplete';

const options = ['Dragon', 'Castle', 'Caverns'];

describe('TokenAutocomplete', () => {
  it('renders existing values as chips and shows the placeholder only when empty', () => {
    const { rerender } = render(
      <TokenAutocomplete values={[]} onChange={() => {}} options={options} placeholder="tag…" />,
    );
    expect(screen.getByPlaceholderText('tag…')).toBeInTheDocument();

    rerender(
      <TokenAutocomplete
        values={['Dragon']}
        onChange={() => {}}
        options={options}
        placeholder="tag…"
      />,
    );
    expect(screen.getByText('Dragon')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('tag…')).not.toBeInTheDocument();
  });

  it('filters options into suggestions as you type, excluding already-selected ones', async () => {
    const user = userEvent.setup();
    render(
      <TokenAutocomplete
        values={['Castle']}
        onChange={() => {}}
        options={options}
        placeholder="tag…"
      />,
    );
    await user.type(screen.getByRole('textbox'), 'ca');
    expect(screen.getByRole('button', { name: 'Caverns' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Castle' })).not.toBeInTheDocument();
  });

  it('adds a clicked suggestion via onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TokenAutocomplete values={[]} onChange={onChange} options={options} placeholder="tag…" />);
    await user.type(screen.getByRole('textbox'), 'dra');
    await user.click(screen.getByRole('button', { name: 'Dragon' }));
    expect(onChange).toHaveBeenCalledWith(['Dragon']);
  });

  it('adds free text that is not in options on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TokenAutocomplete values={[]} onChange={onChange} options={options} placeholder="tag…" />);
    await user.type(screen.getByRole('textbox'), 'wyvern{Enter}');
    expect(onChange).toHaveBeenCalledWith(['wyvern']);
  });

  it('removes a chip when its X is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TokenAutocomplete values={['Dragon', 'Castle']} onChange={onChange} options={options} />);
    await user.click(screen.getByRole('button', { name: 'Remove Dragon' }));
    expect(onChange).toHaveBeenCalledWith(['Castle']);
  });

  it('removes the last chip on Backspace in an empty input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TokenAutocomplete values={['Dragon', 'Castle']} onChange={onChange} options={options} />);
    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenCalledWith(['Dragon']);
  });
});
