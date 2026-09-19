import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenePlate } from './ScenePlate';

/** A PNG data URL whose header declares `width` x `height`; the pixels are never decoded. */
function png(width: number, height: number, tag: string): string {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(b.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return `data:image/png;base64,${btoa(String.fromCharCode(...b))}${tag}`;
}

const IMG = [png(512, 768, 'AAAA'), png(512, 768, 'BBBB'), png(1024, 512, 'CCCC')];
const shown = () => screen.getByRole('img') as HTMLImageElement;

describe('ScenePlate', () => {
  it('renders nothing for a turn with no image', () => {
    const { container } = render(<ScenePlate turnId="t1" images={[]} onDelete={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens on the newest image and browses back through the older ones', () => {
    render(<ScenePlate turnId="t1" images={IMG} onDelete={vi.fn()} />);
    expect(shown().src).toContain('CCCC');
    expect(screen.getByText('3/3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(shown().src).toContain('BBBB');
    expect(screen.getByText('2/3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(shown().src).toContain('CCCC');
    expect(screen.getByRole('button', { name: 'Next image' })).toBeDisabled();
  });

  it('hides the arrows and the count for a single image', () => {
    render(<ScenePlate turnId="t1" images={[IMG[0]]} onDelete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Previous image' })).toBeNull();
    expect(screen.queryByText('1/1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete this image' })).toBeInTheDocument();
  });

  it('deletes the image in view, not the newest', () => {
    const onDelete = vi.fn();
    render(<ScenePlate turnId="t1" images={IMG} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete this image' }));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('zooms on a click', () => {
    render(<ScenePlate turnId="t1" images={IMG} onDelete={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom image' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sizes its box from the image header before the image loads', () => {
    render(<ScenePlate turnId="t1" images={IMG} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Zoom image' }).style.aspectRatio).toBe('1024 / 512');
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(screen.getByRole('button', { name: 'Zoom image' }).style.aspectRatio).toBe('512 / 768');
  });

  it('reaches every control by keyboard', () => {
    render(<ScenePlate turnId="t1" images={IMG} onDelete={vi.fn()} />);
    for (const name of ['Zoom image', 'Previous image', 'Next image', 'Delete this image']) {
      expect(screen.getByRole('button', { name }).tabIndex).toBe(0);
    }
  });

  it('opens on the newest image of another turn, and follows a new image in', () => {
    const { rerender } = render(<ScenePlate turnId="t1" images={IMG} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(screen.getByText('1/3')).toBeInTheDocument();

    rerender(<ScenePlate turnId="t2" images={IMG.slice(0, 2)} onDelete={vi.fn()} />);
    expect(screen.getByText('2/2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    rerender(<ScenePlate turnId="t2" images={IMG} onDelete={vi.fn()} />);
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });

  it('opens on the newest image of another turn with the same image count', () => {
    const { rerender } = render(<ScenePlate turnId="t1" images={IMG} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    rerender(<ScenePlate turnId="t2" images={IMG} onDelete={vi.fn()} />);
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });
});
