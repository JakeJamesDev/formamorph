import { describe, it, expect, vi } from 'vitest';
import { createRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import { Input } from './input';

// Wheel-stepping a focused number field is Input's job to wire up; the stepping itself is covered in
// `lib/numberInputWheel.test.ts`. These cover the wiring, including that it reaches a controlled
// field's onChange — a step React never hears about would revert on the next render.
describe('Input wheel stepping', () => {
  const wheelOn = (el: Element, deltaY = -120) => {
    const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return event;
  };

  it('steps a focused number input', () => {
    const { container } = render(<Input type="number" defaultValue={50} />);
    const input = container.querySelector('input')!;
    input.focus();
    expect(wheelOn(input).defaultPrevented).toBe(true);
    expect(input.value).toBe('51');
  });

  it('reaches onChange so a controlled field keeps the new value', () => {
    const onChange = vi.fn();
    const Controlled = () => {
      const [value, setValue] = useState(50);
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => { onChange(e.target.value); setValue(Number(e.target.value)); }}
        />
      );
    };
    render(<Controlled />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    input.focus();

    wheelOn(input);
    expect(onChange).toHaveBeenCalledWith('51');
    expect(input.value).toBe('51');

    wheelOn(input, 120);
    expect(input.value).toBe('50');
  });

  it('leaves an unfocused number input alone', () => {
    const { container } = render(<Input type="number" defaultValue={50} />);
    const input = container.querySelector('input')!;
    expect(wheelOn(input).defaultPrevented).toBe(false);
    expect(input.value).toBe('50');
  });

  it('does not touch other input types', () => {
    const { container } = render(<Input type="text" defaultValue="50" />);
    const input = container.querySelector('input')!;
    input.focus();
    expect(wheelOn(input).defaultPrevented).toBe(false);
  });

  it('unbinds on unmount', () => {
    const { container, unmount } = render(<Input type="number" defaultValue={50} />);
    const input = container.querySelector('input')!;
    input.focus();
    unmount();
    expect(wheelOn(input).defaultPrevented).toBe(false);
  });

  it('still hands the node to a forwarded ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input type="number" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('still hands the node to a callback ref', () => {
    let seen: HTMLInputElement | null = null;
    render(<Input type="text" ref={(node) => { seen = node; }} />);
    expect(seen).toBeInstanceOf(HTMLInputElement);
  });
});
