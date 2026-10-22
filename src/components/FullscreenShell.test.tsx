import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { FullscreenShell } from './FullscreenShell';
import { dialogCornerButton } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MorphFullscreen } from '@/lib/useMorphFullscreen';

const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

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

  it('shows a heading only when asked, sized as a field caption and centered on mobile', () => {
    render(<FullscreenShell morph={openMorph()} title="Prompts" showTitle>body</FullscreenShell>);
    const heading = screen.getByText('Prompts');
    // A caption, not a dialog heading: it names a box inside the app.
    expect(heading.className).toContain('text-label');
    expect(heading.parentElement?.className).toContain('text-center');
    expect(heading.parentElement?.className).toContain('sm:text-left');
  });
});

describe('every full-screen surface goes through the shell', () => {
  // These drifted into four hand-rolled overlays disagreeing on the header, the close button and the
  // animation. Rolling a fifth is how that starts again.
  const surfaces = [
    'src/components/prompt/CodeArea.tsx',
    'src/components/prompt/PromptField.tsx',
    'src/components/PanelShell.tsx',
  ];
  /** Whole panels lift through the panel shell, which renders the shell above. */
  const panels = [
    'src/components/modals/SettingsModal.tsx',
    'src/components/formaquestion/FormaquestionPromptsTab.tsx',
    'src/components/formaquestion/FormaquestionMascotTab.tsx',
  ];

  it.each(surfaces)('%s builds no full-screen overlay of its own', (file) => {
    const src = read(file);
    // The rendered tag, not just the import: an aliased or unused import proves nothing about what is
    // actually on screen.
    expect(src).toMatch(/<FullscreenShell[\s>]/);
    // `dialogFullHeight` is the shell's own business; a surface reaching for it is hand-rolling the window.
    expect(src).not.toMatch(/\bdialogFullHeight\b/);
  });

  it.each(panels)('%s lifts its panel through the panel shell', (file) => {
    const src = read(file);
    expect(src).toMatch(/<PanelShell[\s>]/);
    expect(src).not.toMatch(/<FullscreenShell[\s>]|\bdialogFullHeight\b/);
  });

  it('lets the one window that grows in place keep doing so, but on the same animation', () => {
    // Edit Text has a footer holding the save: raising an overlay would put a window over the buttons that
    // commit the edit. It resizes itself instead, and morphs between its own two rects.
    const src = read('src/components/modals/EditTextModal.tsx');
    expect(src).toContain('useMorphResize');
    expect(src).toContain('hideClose');
  });
});
