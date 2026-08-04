import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { toast } from 'react-toastify';

vi.mock('./theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));
import { ThemedToastContainer } from './ThemedToastContainer';

/** The container only mounts once something is on screen, so every case raises a toast first. */
const renderWithToast = async (props: Parameters<typeof ThemedToastContainer>[0] = {}) => {
  render(<ThemedToastContainer {...props} />);
  act(() => { toast('hello'); });
  await screen.findByText('hello');
  return document.querySelector('.Toastify__toast-container') as HTMLElement;
};

afterEach(() => act(() => toast.dismiss()));

describe('ThemedToastContainer', () => {
  it('points every hard-coded react-toastify color at a design token', async () => {
    const { style } = await renderWithToast();

    // The panel, which the library otherwise paints a flat neutral (#121212 dark / #fff light).
    expect(style.getPropertyValue('--toastify-color-dark')).toBe('hsl(var(--popover))');
    expect(style.getPropertyValue('--toastify-color-light')).toBe('hsl(var(--popover))');
    expect(style.getPropertyValue('--toastify-text-color-dark')).toBe('hsl(var(--popover-foreground))');
    expect(style.getPropertyValue('--toastify-text-color-light')).toBe('hsl(var(--popover-foreground))');

    // A default-type toast's progress bar, which doesn't derive from the per-type accents.
    expect(style.getPropertyValue('--toastify-color-progress-dark')).toBe('hsl(var(--primary))');
    expect(style.getPropertyValue('--toastify-color-progress-light')).toBe('hsl(var(--primary))');

    // The per-type accents.
    expect(style.getPropertyValue('--toastify-color-success')).toBe('hsl(var(--success))');
    expect(style.getPropertyValue('--toastify-color-error')).toBe('hsl(var(--destructive))');
  });

  it('gives the toast a border without dropping the library classes', async () => {
    await renderWithToast();
    const el = document.querySelector('.Toastify__toast') as HTMLElement;
    expect(el.className).toContain('border border-border');
    expect(el.className).toContain('Toastify__toast-theme--dark');
  });

  it('keeps a caller toastClassName alongside the border', async () => {
    await renderWithToast({ toastClassName: 'caller-class' });
    const el = document.querySelector('.Toastify__toast') as HTMLElement;
    expect(el.className).toContain('caller-class');
    expect(el.className).toContain('border border-border');
  });

  it('keeps a caller style prop alongside the tokens', async () => {
    const el = await renderWithToast({ style: { zIndex: 42 } });
    expect(el.style.zIndex).toBe('42');
    expect(el.style.getPropertyValue('--toastify-color-dark')).toBe('hsl(var(--popover))');
  });
});
