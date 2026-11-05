import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FullscreenShell } from './FullscreenShell';
import { dialogCornerButton } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MorphFullscreen } from '@/lib/useMorphFullscreen';

const openMorph = (): MorphFullscreen => ({
  mounted: true,
  contentInOverlay: true,
  boxClassName: '',
  phase: 'open',
  open: () => {},
  close: () => {},
  toggle: () => {},
  boxRef: () => {},
  veilClassName: '',
  overlayClassName: '',
});

describe('FullscreenShell', () => {
  it('exits from the dialog-close slot, at its touch size', () => {
    const close = vi.fn();
    render(<FullscreenShell morph={{ ...openMorph(), close }} title="Stat code">body</FullscreenShell>);
    const exit = screen.getByRole('button', { name: 'Exit full screen' });
    expect(exit.className).toBe(cn(dialogCornerButton, 'z-[5]'));
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(exit);
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes, named for the window, when the window is the whole surface', () => {
    const close = vi.fn();
    render(<FullscreenShell morph={{ ...openMorph(), close }} title="Guide" closes>body</FullscreenShell>);
    expect(screen.queryByRole('button', { name: 'Exit full screen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close Guide' }));
    expect(close).toHaveBeenCalledOnce();
  });

  it('names the window without spending a row on it by default', () => {
    render(<FullscreenShell morph={openMorph()} title="Stat code">body</FullscreenShell>);
    // Named for a screen reader, invisible to everyone else — the field's own caption travels with it, so
    // a heading here would say it twice and cost a row of the editor.
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Stat code');
    expect(screen.getByText('Stat code').closest('div')?.className).toContain('sr-only');
  });

  it('shows a heading only when asked, sized as a dialog title and centered on mobile', () => {
    render(<FullscreenShell morph={openMorph()} title="Prompts" showTitle>body</FullscreenShell>);
    const heading = screen.getByText('Prompts');
    expect(heading.className).toContain('text-title');
    expect(heading.parentElement?.className).toContain('text-center');
    expect(heading.parentElement?.className).toContain('sm:text-left');
  });
});
