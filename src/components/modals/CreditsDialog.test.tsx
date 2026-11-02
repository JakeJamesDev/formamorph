import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ITEM_ICON_AUTHORS } from '@/lib/itemIcons';
import { CreditsDialog } from './CreditsDialog';

afterEach(() => {
  cleanup();
  delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop;
});

describe('CreditsDialog', () => {
  it('opens on the Credits tab and names every author of a shipped icon', () => {
    render(<CreditsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Credits', selected: true })).toBeInTheDocument();
    const panel = screen.getByRole('tabpanel');
    for (const author of ITEM_ICON_AUTHORS) expect(panel).toHaveTextContent(author);
    expect(panel).toHaveTextContent('Jake James');
    expect(panel).toHaveTextContent('FieryLionite');
  });

  it('gives every credited name one text style', () => {
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    render(<CreditsDialog open onOpenChange={vi.fn()} />);
    const names = ['Jake James', 'FieryLionite', 'llama.cpp', new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(ITEM_ICON_AUTHORS)]
      .map((name) => screen.getByText(name).className);
    expect(new Set(names).size).toBe(1);
  });

  it('links the site and the license', () => {
    render(<CreditsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'game-icons.net' })).toHaveAttribute('href', 'https://game-icons.net');
    expect(screen.getByRole('link', { name: 'creativecommons.org/licenses/by/3.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/3.0/');
    expect(screen.getByRole('tabpanel')).toHaveTextContent("draws them in your theme's colors");
  });

  it('names llama.cpp on desktop only', () => {
    const { unmount } = render(<CreditsDialog open onOpenChange={vi.fn()} />);
    expect(screen.queryByText('llama.cpp')).toBeNull();
    unmount();
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    render(<CreditsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText('llama.cpp')).toBeInTheDocument();
  });

  it('stays closed until opened', () => {
    render(<CreditsDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
