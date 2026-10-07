import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { SearchField, type SearchFieldProps } from './search-field';

/** A host that owns the value, as every caller does. */
function Host({ onChange, ...props }: Partial<SearchFieldProps>) {
  const [value, setValue] = useState('');
  return (
    <SearchField
      aria-label="Search Places"
      value={value}
      onChange={(next) => { setValue(next); onChange?.(next); }}
      {...props}
    />
  );
}

const box = () => screen.getByRole('searchbox', { name: 'Search Places' });
const clearButton = () => screen.queryByRole('button', { name: 'Clear Search' });

describe('SearchField', () => {
  it('shows the Clear Search X only while the box holds text', async () => {
    const user = userEvent.setup();
    render(<Host />);

    expect(clearButton()).toBeNull();
    await user.type(box(), 'harbor');
    expect(clearButton()).toBeInTheDocument();
    await user.clear(box());
    expect(clearButton()).toBeNull();
  });

  it('empties the box through onChange and returns focus to it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    await user.type(box(), 'harbor');
    onChange.mockClear();

    await user.click(clearButton()!);

    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
    expect(box()).toHaveValue('');
    expect(box()).toHaveFocus();
    expect(clearButton()).toBeNull();
  });

  it('runs onClear in place of the empty onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<SearchField aria-label="Search Places" value="harbor" onChange={onChange} onClear={onClear} />);

    await user.click(clearButton()!);

    expect(onClear).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(box()).toHaveFocus();
  });

  it('keeps its text on Escape and passes the key to the host', () => {
    const onKeyDown = vi.fn();
    render(<SearchField aria-label="Search Places" value="harbor" onChange={() => {}} onKeyDown={onKeyDown} />);

    // jsdom has no native Escape clear; a prevented default is what stops Chromium's.
    expect(fireEvent.keyDown(box(), { key: 'Escape' })).toBe(false);
    expect(onKeyDown).toHaveBeenCalledOnce();
  });

  it('lets a host dialog close on Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Places</DialogTitle>
          <SearchField aria-label="Search Places" value="harbor" onChange={() => {}} />
        </DialogContent>
      </Dialog>,
    );
    box().focus();

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('leaves other keys to the browser', () => {
    render(<SearchField aria-label="Search Places" value="harbor" onChange={() => {}} />);

    expect(fireEvent.keyDown(box(), { key: 'Enter' })).toBe(true);
  });

  it('hides the native cancel button', () => {
    render(<SearchField aria-label="Search Places" value="harbor" onChange={() => {}} />);

    expect(box()).toHaveAttribute('type', 'search');
    expect(box()).toHaveClass('[&::-webkit-search-cancel-button]:appearance-none');
  });

  it('sets the field height and scales the icon and X with the size variant', () => {
    // jsdom draws no layout, so the height and icon scale read from their utility classes.
    const { rerender } = render(<SearchField aria-label="Search Places" value="harbor" onChange={() => {}} />);
    const iconSize = () => clearButton()!.querySelector('svg')!;
    expect(box()).toHaveClass('h-10');
    expect(iconSize()).toHaveClass('h-4');

    rerender(<SearchField aria-label="Search Places" value="harbor" onChange={() => {}} size="sm" />);
    expect(box()).toHaveClass('h-8');
    expect(box()).not.toHaveClass('h-10');
    expect(iconSize()).toHaveClass('h-3.5');
    expect(clearButton()).toHaveClass('h-6');
  });

  it('styles the wrapper with className and the input with inputClassName', () => {
    render(<SearchField aria-label="Search Places" value="" onChange={() => {}} className="w-64" inputClassName="text-meta" />);

    expect(box()).toHaveClass('text-meta');
    expect(box()).not.toHaveClass('w-64');
    expect(box().parentElement).toHaveClass('w-64');
  });
});
