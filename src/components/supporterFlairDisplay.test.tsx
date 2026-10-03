import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SupporterBadge } from './SupporterBadge';
import { TooltipProvider } from './ui/tooltip';
import { UserAvatar } from './UserAvatar';
import { UserName } from './UserName';
import { UserProfileContext } from '@/contexts/userProfileStore';
import { SUPPORTER_TIERS } from '@/lib/supporterFlair';
import type { SupporterFlair } from '@/types';

afterEach(cleanup);

const name = (supporter: SupporterFlair | null | undefined, role?: string) =>
  render(
    <UserProfileContext.Provider value={{ openProfile: () => {}, setListingOpener: () => {} }}>
      <UserName userId="u1" username="river-quill" role={role} supporter={supporter} />
    </UserProfileContext.Provider>,
  );

describe.each(SUPPORTER_TIERS)('a %s name', (tier) => {
  it('shows the tier badge and the tier color', () => {
    name({ tier, since: null });

    expect(screen.getByText(tier === 'supporter' ? 'Supporter' : 'Supporter+')).toBeTruthy();
    expect(screen.getByRole('button', { name: "View river-quill's profile" }).className)
      .toContain(tier === 'supporter' ? 'text-supporter' : 'text-supporter-plus');
  });

  it('draws the tier ring on the Profile Image', () => {
    const { container } = render(<UserAvatar username="river-quill" supporter={{ tier, since: null }} size="md" />);

    expect((container.firstElementChild as HTMLElement).className)
      .toContain(tier === 'supporter' ? 'ring-supporter' : 'ring-supporter-plus');
  });
});

describe('a name with no flair', () => {
  it.each([null, undefined])('draws nothing for %s', (supporter) => {
    name(supporter);
    const { container } = render(<UserAvatar username="river-quill" supporter={supporter} />);

    expect(screen.queryByText(/^Supporter/)).toBeNull();
    expect(screen.getByRole('button').className).not.toContain('text-supporter');
    expect((container.firstElementChild as HTMLElement).className).not.toContain('ring-supporter');
  });

  it('adds no staff rule of its own: it draws what the server sent', () => {
    name({ tier: 'supporter', since: null }, 'mod');

    expect(screen.getByText('Supporter')).toBeTruthy();
    expect(screen.getByText('Mod')).toBeTruthy();
  });
});

describe('the badge tooltip', () => {
  const hover = async (since: string | null) => {
    render(<TooltipProvider><SupporterBadge tier="supporter" since={since} /></TooltipProvider>);
    await userEvent.hover(screen.getByText('Supporter'));
  };

  it('states the tenure', async () => {
    const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
    await hover(since);

    expect(await screen.findByText('Supporting for 1 year, 1 month')).toBeTruthy();
  });

  it.each([
    [0, 'Supporting for 0 months'],
    [11, 'Supporting for 11 months'],
    [14, 'Supporting for 1 year, 2 months'],
  ])('words a pledge of %i months', async (months, wording) => {
    const now = new Date();
    await hover(new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString());

    expect(await screen.findByText(wording)).toBeTruthy();
  });

  it('shows no tenure when the start is null', async () => {
    await hover(null);
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(screen.queryByText(/Supporting for/)).toBeNull();
  });
});
