import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CommunityCardReference } from './CommunityCardReference';

const renderReference = () => render(
  <TooltipProvider>
    <CommunityCardReference />
  </TooltipProvider>,
);

afterEach(() => localStorage.clear());

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
});
