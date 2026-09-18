import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from './color-picker';

function Harness({ initial = '#336699', onChange = () => {}, onReset }: {
  initial?: string;
  onChange?: (hex: string) => void;
  onReset?: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ColorPicker
      aria-label="Dialogue Color"
      value={value}
      onChange={(hex) => { onChange(hex); setValue(hex); }}
      onReset={onReset && (() => { onReset(); setValue('#ffffff'); })}
      resetLabel="Reset to Theme"
    />
  );
}

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /Dialogue Color/ }));
  return screen.findByRole('textbox', { name: 'Hex Color' });
};

describe('ColorPicker', () => {
  it('shows the value on the swatch', () => {
    render(<Harness initial="#336699" />);
    const trigger = screen.getByRole('button', { name: /Dialogue Color/ });
    expect(trigger).toHaveTextContent('#336699');
    expect(trigger.querySelector('[data-color-swatch]')).toHaveStyle({ backgroundColor: '#336699' });
  });

  it('commits a valid 6-digit hex and updates the swatch', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const field = await open(user);

    await user.clear(field);
    await user.type(field, 'AA11CC');

    expect(onChange).toHaveBeenLastCalledWith('#aa11cc');
    // The modal popover hides everything outside it from the accessibility tree.
    expect(screen.getByRole('button', { name: /Dialogue Color/, hidden: true }).querySelector('[data-color-swatch]'))
      .toHaveStyle({ backgroundColor: '#aa11cc' });
  });

  it('keeps the last valid color when the entry is invalid', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const field = await open(user);

    await user.clear(field);
    await user.type(field, '#abc');
    await user.type(field, 'zz');
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(field).toHaveValue('#336699');
  });

  it('fires reset from the popover', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<Harness onReset={onReset} />);
    await open(user);

    await user.click(screen.getByRole('button', { name: 'Reset to Theme' }));

    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Hex Color' })).toHaveValue('#ffffff');
  });

  it('hides reset when the caller gives no handler', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    expect(screen.queryByRole('button', { name: 'Reset to Theme' })).not.toBeInTheDocument();
  });

  it('opens from the keyboard and returns focus to the trigger on Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: /Dialogue Color/ });

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('slider', { name: 'Color' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('slider', { name: 'Color' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('reaches the square and the hue bar by keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open(user);

    const hue = screen.getByRole('slider', { name: 'Hue' });
    expect(screen.getByRole('slider', { name: 'Color' })).toHaveAttribute('tabindex', '0');
    // react-colorful reads keyCode, which browsers set and user-event does not.
    fireEvent.keyDown(hue, { key: 'ArrowRight', keyCode: 39 });

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
