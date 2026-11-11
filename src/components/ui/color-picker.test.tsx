import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from './color-picker';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

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
    expect(trigger).toHaveAccessibleDescription('#336699');
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

  it('commits a pasted value with surrounding spaces', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const field = await open(user);

    await user.clear(field);
    await user.paste(' #aa11cc ');

    expect(onChange).toHaveBeenLastCalledWith('#aa11cc');
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
    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const moved = onChange.mock.calls.at(-1)?.[0];
    expect(moved).toMatch(/^#[0-9a-f]{6}$/);
    expect(moved).not.toBe('#336699');
  });

  describe('eyedropper', () => {
    afterEach(() => vi.unstubAllGlobals());
    const stubDropper = (run: () => Promise<{ sRGBHex: string }>) => {
      vi.stubGlobal('EyeDropper', class { open = run; });
    };
    const dropper = () => screen.queryByRole('button', { name: 'Pick From Screen' });

    it('shows no button where the browser has no EyeDropper', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await open(user);
      expect(dropper()).not.toBeInTheDocument();
    });

    it('commits a pick once, keeps the picker open, and reports start and end', async () => {
      stubDropper(async () => ({ sRGBHex: '#AA11CC' }));
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onPickStart = vi.fn();
      const onPickEnd = vi.fn();
      function Pick() {
        const [value, setValue] = useState('#336699');
        return <ColorPicker aria-label="Dialogue Color" value={value} onPickStart={onPickStart} onPickEnd={onPickEnd}
          onChange={(hex) => { onChange(hex); setValue(hex); }} />;
      }
      render(<Pick />);
      await open(user);

      await user.click(dropper()!);

      await waitFor(() => expect(onPickEnd).toHaveBeenCalledOnce());
      expect(onPickStart).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange).toHaveBeenCalledWith('#aa11cc');
      expect(screen.getByRole('textbox', { name: 'Hex Color' })).toHaveValue('#aa11cc');
    });

    it('drops a queued drag frame so it cannot overwrite the pick', async () => {
      let finish: (hex: string) => void = () => {};
      stubDropper(() => new Promise((resolve) => { finish = (hex) => resolve({ sRGBHex: hex }); }));
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await open(user);
      await user.click(dropper()!);

      let frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
      vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
      fireEvent.keyDown(screen.getByRole('slider', { name: 'Hue' }), { key: 'ArrowRight', keyCode: 39 });
      await act(async () => finish('#112233'));
      act(() => { frames.forEach((cb) => cb(0)); });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith('#112233');
    });

    it('leaves the color alone on a canceled pick, with the picker still open', async () => {
      stubDropper(() => Promise.reject(new DOMException('canceled', 'AbortError')));
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onPickEnd = vi.fn();
      render(<ColorPicker aria-label="Dialogue Color" value="#336699" onChange={onChange} onPickEnd={onPickEnd} />);
      await open(user);

      await user.click(dropper()!);

      await waitFor(() => expect(onPickEnd).toHaveBeenCalledOnce());
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('textbox', { name: 'Hex Color' })).toHaveValue('#336699');
    });

    it('keeps the picker open through a pick inside a dialog', async () => {
      let finish: (hex: string) => void = () => {};
      stubDropper(() => new Promise((resolve) => { finish = (hex) => resolve({ sRGBHex: hex }); }));
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <Dialog open>
          <DialogContent>
            <DialogTitle>Colors</DialogTitle>
            <DialogDescription>Pick one.</DialogDescription>
            <ColorPicker aria-label="Dialogue Color" value="#336699" onChange={onChange} />
          </DialogContent>
        </Dialog>,
      );
      await open(user);
      await user.click(dropper()!);

      // The sampler's click lands outside the popover; the popover must not read it as a dismissal.
      fireEvent.pointerDown(document.body);
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      await act(async () => finish('#112233'));

      await waitFor(() => expect(onChange).toHaveBeenCalledWith('#112233'));
      expect(screen.getByRole('textbox', { name: 'Hex Color' })).toBeInTheDocument();
    });
  });

  describe('drag throttling', () => {
    let frames: FrameRequestCallback[] = [];
    const stubFrames = () => {
      frames = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
      vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
    };
    afterEach(() => vi.unstubAllGlobals());

    it('sends one parent change per frame for a burst of moves, ending on the final color', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await open(user);
      stubFrames();

      const hue = screen.getByRole('slider', { name: 'Hue' });
      for (let i = 0; i < 20; i++) fireEvent.keyDown(hue, { key: 'ArrowRight', keyCode: 39 });
      expect(onChange).not.toHaveBeenCalled();

      act(() => { frames.forEach((cb) => cb(0)); });
      expect(onChange).toHaveBeenCalledTimes(1);
      const sent = onChange.mock.calls[0][0];
      expect(sent).not.toBe('#336699');
      expect(screen.getByRole('textbox', { name: 'Hex Color', hidden: true })).toHaveValue(sent);
    });

    it('sends the final color on release without waiting for the frame', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      await open(user);
      stubFrames();

      const hue = screen.getByRole('slider', { name: 'Hue' });
      fireEvent.pointerDown(hue, { button: 0 });
      fireEvent.keyDown(hue, { key: 'ArrowRight', keyCode: 39 });
      fireEvent.keyDown(hue, { key: 'ArrowRight', keyCode: 39 });
      expect(onChange).not.toHaveBeenCalled();

      act(() => { fireEvent.pointerUp(window); });
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});
