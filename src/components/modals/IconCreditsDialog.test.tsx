import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ITEM_ICON_AUTHORS } from '@/lib/itemIcons';
import { ICON_CREDIT_LINE, IconCreditsDialog } from './IconCreditsDialog';

describe('IconCreditsDialog', () => {
  it('names every author of a shipped icon, in the line and in the dialog', () => {
    render(<IconCreditsDialog open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    for (const author of ITEM_ICON_AUTHORS) {
      expect(ICON_CREDIT_LINE).toContain(author);
      expect(dialog).toHaveTextContent(author);
    }
  });

  it('links the site and the license', () => {
    render(<IconCreditsDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'game-icons.net' })).toHaveAttribute('href', 'https://game-icons.net');
    expect(screen.getByRole('link', { name: 'creativecommons.org/licenses/by/3.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/3.0/');
  });

  it('stays closed until opened', () => {
    render(<IconCreditsDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
