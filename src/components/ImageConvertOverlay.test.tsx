import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImageConvertOverlay } from './ImageConvertOverlay';


const THUMB = 'data:image/webp;base64,AAAA';

describe('ImageConvertOverlay', () => {
  it('counts the batch when several images were handed over', () => {
    render(<ImageConvertOverlay thumb={THUMB} done={2} total={5} />);

    expect(screen.getByText('Converting 3 of 5…')).toBeTruthy();
    // A real position to report, so the bar carries one.
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows no position for a single image, because the worker reports none', () => {
    render(<ImageConvertOverlay thumb={THUMB} done={0} total={1} />);

    expect(screen.getByText('Converting…')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows the picture being worked on behind the bar', () => {
    const { container } = render(<ImageConvertOverlay thumb={THUMB} done={0} total={1} />);

    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(THUMB);
    expect(img.className).toMatch(/opacity-25/);
  });

  it('shows the whole picture rather than cropping to the frame', () => {
    const { container, rerender } = render(<ImageConvertOverlay thumb={THUMB} done={0} total={1} />);
    expect(container.querySelector('img')!.className).toMatch(/object-contain/);

    // A slot that crops its picture gets an overlay that crops the same way, or the picture visibly jumps
    // to a different framing for the length of the encode.
    rerender(<ImageConvertOverlay thumb={THUMB} done={0} total={1} objectFit="cover" />);
    expect(container.querySelector('img')!.className).toMatch(/object-cover/);
  });

  it('names what it is doing for a screen reader', () => {
    const { rerender } = render(<ImageConvertOverlay thumb={THUMB} done={0} total={1} />);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Converting image');

    rerender(<ImageConvertOverlay thumb={THUMB} done={1} total={4} />);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Converting image 2 of 4');
  });

  it('holds still for a reader who asked for less motion', () => {
    const { container } = render(<ImageConvertOverlay thumb={THUMB} done={0} total={1} />);

    expect(container.querySelector('.animate-pulse')!.className).toMatch(/motion-reduce:animate-none/);
  });
});
