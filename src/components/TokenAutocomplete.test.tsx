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

  it('keeps a typed comma literal instead of committing a chip', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TokenAutocomplete values={[]} onChange={onChange} options={options} placeholder="tag…" />);
    await user.type(screen.getByRole('textbox'), 'wyvern, winged{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['wyvern, winged']);
  });

  it('adds one chip per line from a multi-line paste', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TokenAutocomplete values={[]} onChange={onChange} options={options} placeholder="tag…" />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('red\nblue\ngreen');
    expect(onChange).toHaveBeenCalledWith(['red', 'blue', 'green']);
  });

  it('leaves a single-line paste in the buffer, commas intact', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TokenAutocomplete values={[]} onChange={onChange} options={options} placeholder="tag…" />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('red, blue');
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(['red, blue']);
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

  it('does not show suggestions on focus by default (only after typing)', async () => {
    const user = userEvent.setup();
    render(<TokenAutocomplete values={[]} onChange={() => {}} options={options} placeholder="tag…" />);
    await user.click(screen.getByRole('textbox'));
    expect(screen.queryByRole('button', { name: 'Dragon' })).not.toBeInTheDocument();
  });

  it('with openOnFocus, shows all unselected options the moment the field is focused', async () => {
    const user = userEvent.setup();
    render(
      <TokenAutocomplete values={['Castle']} onChange={() => {}} options={options} openOnFocus placeholder="tag…" />,
    );
    await user.click(screen.getByRole('textbox'));
    expect(screen.getByRole('button', { name: 'Dragon' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Caverns' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Castle' })).not.toBeInTheDocument(); // already selected
  });

  it('ranks suggestions by input (popularity) order with preserveOrder, alphabetically without', async () => {
    const user = userEvent.setup();
    const ranked = ['blue', 'black', 'blonde']; // popularity order, deliberately non-alphabetical
    const names = () => screen.getAllByRole('button').map((b) => b.textContent);

    const { unmount } = render(
      <TokenAutocomplete values={[]} onChange={() => {}} options={ranked} preserveOrder placeholder="tag…" />,
    );
    await user.type(screen.getByRole('textbox'), 'bl');
    expect(names()).toEqual(['blue', 'black', 'blonde']); // input order kept
    unmount();

    render(<TokenAutocomplete values={[]} onChange={() => {}} options={ranked} placeholder="tag…" />);
    await user.type(screen.getByRole('textbox'), 'bl');
    expect(names()).toEqual(['black', 'blonde', 'blue']); // default: alphabetical
  });

  it('edits a chip in place on double-click when editable (order kept)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TokenAutocomplete values={['blue', 'red']} onChange={onChange} options={[]} reorderable editable placeholder="tag…" />,
    );
    await user.dblClick(screen.getByText('blue'));
    const input = screen.getByLabelText('Edit blue');
    await user.clear(input);
    await user.type(input, 'green{Enter}');
    expect(onChange).toHaveBeenCalledWith(['green', 'red']); // replaced in place
  });

  it('offers autocomplete while editing an editable chip', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TokenAutocomplete values={['blue']} onChange={onChange} options={['blonde hair', 'blue eyes']} reorderable editable preserveOrder placeholder="tag…" />,
    );
    await user.dblClick(screen.getByText('blue'));
    const input = screen.getByLabelText('Edit blue');
    await user.clear(input);
    await user.type(input, 'blo');
    await user.click(screen.getByText('blonde hair'));
    expect(onChange).toHaveBeenCalledWith(['blonde hair']);
  });

  describe('single mode', () => {
    it('shows the value in the input (no chip) and replaces it when a suggestion is picked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<TokenAutocomplete single openOnFocus values={['Castle']} onChange={onChange} options={options} />);
      // The value is the input text, not a removable chip.
      expect(screen.getByRole('textbox')).toHaveValue('Castle');
      expect(screen.queryByRole('button', { name: 'Remove Castle' })).not.toBeInTheDocument();
      // A committed value opens the full list so you can switch; picking one replaces (not appends).
      await user.click(screen.getByRole('textbox'));
      await user.click(screen.getByRole('button', { name: 'Dragon' }));
      expect(onChange).toHaveBeenCalledWith(['Dragon']);
    });

    it('passes free text straight through and clears to an empty array', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(
        <TokenAutocomplete single values={[]} onChange={onChange} options={options} placeholder="euler" />,
      );
      await user.type(screen.getByRole('textbox'), 'z');
      expect(onChange).toHaveBeenLastCalledWith(['z']);
      rerender(<TokenAutocomplete single values={['z']} onChange={onChange} options={options} placeholder="euler" />);
      await user.clear(screen.getByRole('textbox'));
      expect(onChange).toHaveBeenLastCalledWith([]);
    });
  });
});
