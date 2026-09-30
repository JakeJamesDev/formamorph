import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CommunityCardReference } from './CommunityCardReference';

const { CachedThumbnail } = vi.hoisted(() => ({
  CachedThumbnail: vi.fn(({ file }: { file: string }) => <img alt="" data-file={file} />),
}));
vi.mock('@/lib/useCachedThumbnail', () => ({ CachedThumbnail }));

const renderReference = () => render(
  <TooltipProvider>
    <CommunityCardReference />
  </TooltipProvider>,
);

afterEach(() => localStorage.clear());

const cardNamed = (name: string) => {
  const card = screen.getAllByText(name)[0].closest<HTMLElement>('[data-layout]');
  if (!card) throw new Error(`No card named ${name}`);
  return card;
};

describe('community card reference', () => {
  it('uses production cards with long content and selected likes', () => {
    renderReference();

    expect(screen.getByRole('heading', { name: 'Community Creation Cards' })).toBeInTheDocument();
    expect(screen.getByText(/The Lantern Ledger of Brinewatch/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unlike — 286 likes/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps card callbacks local while exposing pending and completed action states', async () => {
    const user = userEvent.setup();
    renderReference();

    const unlike = screen.getByRole('button', { name: /Unlike — 286 likes/ });
    await user.click(unlike);
    expect(unlike).toBeDisabled();
    expect(screen.getByText('The Unlike action is not complete.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Complete Local Action' }));
    expect(screen.getByRole('button', { name: /Like — 286 likes/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('The local Unlike action is complete.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update available' }));
    expect(screen.getByText('The local update action started for The Glass Marsh Almanac.')).toBeInTheDocument();
  });

  it('shows the hidden like count as a dash that still presses', async () => {
    const user = userEvent.setup();
    renderReference();

    const heart = screen.getByRole('button', { name: 'Like — likes hidden' });
    expect(heart.textContent?.trim()).toBe('—');
    await user.click(heart);
    expect(await screen.findByRole('button', { name: 'Unlike — likes hidden' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('draws Morph art for a flagged stand-in and never shows its stored thumbnail', () => {
    renderReference();

    const card = cardNamed('Sable Lantern-Wright');
    expect(card.querySelector('[data-morph-art]')).not.toBeNull();
    expect(CachedThumbnail).not.toHaveBeenCalled();
    expect(card.querySelector('img')).toBeNull();
  });

  it('draws Morph art for a flagged Avatar and never shows its stored thumbnail', () => {
    renderReference();

    const card = cardNamed('Ember Stride');
    expect(card.dataset.layout).toBe('split');
    expect(card.querySelector('[data-morph-art]')).not.toBeNull();
    expect(CachedThumbnail).not.toHaveBeenCalled();
  });

  it('shows an Avatar in the split layout', () => {
    renderReference();

    expect(cardNamed('Tide Walker, a Full-Body Avatar for Lantern Ledger Readers').dataset.layout).toBe('split');
  });

  it('draws Morph art for an entity with no image', () => {
    renderReference();

    expect(cardNamed('Quill Warden').querySelector('[data-morph-art]')).not.toBeNull();
  });
});
