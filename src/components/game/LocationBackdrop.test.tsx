import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocationBackdrop } from './LocationBackdrop';

const imageLayer = () => screen.getByTestId('location-backdrop-image');
const overlayLayer = () => screen.queryByTestId('location-backdrop-overlay');

describe('LocationBackdrop', () => {
  it('paints the location image', () => {
    render(<LocationBackdrop image="scene.png" overlay={0} overlayHidden={false} />);
    expect(imageLayer().style.backgroundImage).toBe('url("scene.png")');
  });

  it('paints nothing without an image', () => {
    const { container } = render(<LocationBackdrop image={null} overlay={0.5} overlayHidden={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  // The fix: sharing a layer with the UI is what made a complex SVG re-rasterize on every keystroke.
  it('promotes the image to its own compositor layer', () => {
    render(<LocationBackdrop image="scene.svg" overlay={0} overlayHidden={false} />);
    expect(imageLayer().style.transform).toBe('translateZ(0)');
    expect(imageLayer().style.willChange).toBe('transform');
  });

  // Folding the fade into the image's own background would invalidate its raster whenever the slider moves.
  it('keeps the fade off the image layer', () => {
    render(<LocationBackdrop image="scene.png" overlay={0.4} overlayHidden={false} />);
    expect(overlayLayer()).not.toBe(null);
    expect(overlayLayer()).not.toBe(imageLayer());
    expect(overlayLayer()!.style.backgroundColor).toBe('hsl(var(--background) / 0.4)');
    expect(imageLayer().style.backgroundColor).toBe('');
    expect(imageLayer().style.backgroundImage).toBe('url("scene.png")');
  });

  it('drops the fade at zero', () => {
    render(<LocationBackdrop image="scene.png" overlay={0} overlayHidden={false} />);
    expect(overlayLayer()).toBe(null);
  });

  // Hide UI reveals the art as authored.
  it('drops the fade while the UI is hidden', () => {
    render(<LocationBackdrop image="scene.png" overlay={0.6} overlayHidden />);
    expect(overlayLayer()).toBe(null);
    expect(imageLayer().style.backgroundImage).toBe('url("scene.png")');
  });

  it('covers the view behind the UI', () => {
    render(<LocationBackdrop image="scene.png" overlay={0.4} overlayHidden={false} />);
    for (const layer of [imageLayer(), overlayLayer()!]) {
      expect(layer.className).toContain('absolute');
      expect(layer.className).toContain('inset-0');
      expect(layer.className).toContain('-z-10');
    }
    expect(imageLayer().className).toContain('bg-cover');
    expect(imageLayer().className).toContain('bg-center');
  });

  it('hides both layers from assistive tech', () => {
    render(<LocationBackdrop image="scene.png" overlay={0.4} overlayHidden={false} />);
    expect(imageLayer()).toHaveAttribute('aria-hidden', 'true');
    expect(overlayLayer()).toHaveAttribute('aria-hidden', 'true');
  });
});
