import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoleBadge } from './RoleBadge';
import { SupporterBadge } from './SupporterBadge';
import { UserName } from './UserName';
import { UserProfileContext } from '@/contexts/userProfileStore';
import { stubReducedMotion } from '@/test/reducedMotion';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the supporter badge', () => {
  it('names the tier', () => {
    render(<><SupporterBadge tier="supporter" /><SupporterBadge tier="supporter_plus" /></>);

    expect(screen.getByText('Supporter')).toBeTruthy();
    expect(screen.getByText('Supporter+')).toBeTruthy();
  });

  it('styles Supporter+ apart from Supporter by more than the label', () => {
    const { container } = render(<><SupporterBadge tier="supporter" /><SupporterBadge tier="supporter_plus" /></>);
    const [plain, plus] = Array.from(container.children) as HTMLElement[];

    expect(plus.className).toContain('ring-1');
    expect(plain.className).not.toContain('ring-1');
    expect(plus.querySelector('svg')?.outerHTML).not.toBe(plain.querySelector('svg')?.outerHTML);
  });

  it('shares no tint with a staff badge', () => {
    const tints = (node: HTMLElement) => node.className.split(' ').filter((c) => /^(bg|text)-/.test(c) && !c.startsWith('text-['));
    const { container } = render(
      <><SupporterBadge tier="supporter" /><SupporterBadge tier="supporter_plus" />
        <RoleBadge role="mod" /><RoleBadge role="dev" /><RoleBadge role="admin" /></>,
    );
    const [s, sp, ...staff] = Array.from(container.children) as HTMLElement[];

    for (const staffBadge of staff) {
      for (const tint of [...tints(s), ...tints(sp)]) expect(tints(staffBadge)).not.toContain(tint);
    }
  });
});

// The arrival record is module state that lives for the page load, so each test names its own account.
describe('the heartbeat on arrival', () => {
  const heart = (container: HTMLElement) => container.querySelector('.supporter-heart') as SVGElement;
  const arrives = (container: HTMLElement) => heart(container).classList.contains('supporter-heart-arrive');

  it('beats the first badge for an account', () => {
    const { container } = render(<SupporterBadge tier="supporter" beatKey="acct-first" />);

    expect(arrives(container)).toBe(true);
  });

  it('does not beat a later badge for the same account, and still shows it', () => {
    render(<SupporterBadge tier="supporter" beatKey="acct-twice" />).unmount();

    const { container } = render(<SupporterBadge tier="supporter" beatKey="acct-twice" />);

    expect(screen.getByText('Supporter')).toBeTruthy();
    expect(arrives(container)).toBe(false);
  });

  it('beats a badge for a different account', () => {
    render(<SupporterBadge tier="supporter" beatKey="acct-seen" />).unmount();

    const { container } = render(<SupporterBadge tier="supporter" beatKey="acct-new" />);

    expect(arrives(container)).toBe(true);
  });

  it('still beats once under Strict Mode, which mounts twice', () => {
    const { container } = render(<StrictMode><SupporterBadge tier="supporter" beatKey="acct-strict" /></StrictMode>);

    expect(arrives(container)).toBe(true);
  });

  it('skips the beat under reduced motion', () => {
    stubReducedMotion();

    const { container } = render(<SupporterBadge tier="supporter" beatKey="acct-reduced" />);

    expect(arrives(container)).toBe(false);
  });

  it('counts an account that arrived under reduced motion as seen', () => {
    stubReducedMotion();
    render(<SupporterBadge tier="supporter" beatKey="acct-reduced-seen" />).unmount();
    vi.unstubAllGlobals();

    const { container } = render(<SupporterBadge tier="supporter" beatKey="acct-reduced-seen" />);

    expect(arrives(container)).toBe(false);
  });

  it('has no arrival beat without an account key', () => {
    const { container } = render(<SupporterBadge tier="supporter" />);

    expect(arrives(container)).toBe(false);
  });

  it('takes the arrival class off when the beat ends, so a hover can start it again', () => {
    const { container } = render(<SupporterBadge tier="supporter" beatKey="acct-ends" />);

    fireEvent.animationEnd(heart(container));

    expect(arrives(container)).toBe(false);
  });
});

describe('the name passes the account to its badge', () => {
  const name = (userId: string) =>
    render(
      <UserProfileContext.Provider value={{ openProfile: () => {}, setListingOpener: () => {} }}>
        <UserName userId={userId} username="river-quill" supporter={{ tier: 'supporter', since: null }} />
      </UserProfileContext.Provider>,
    );
  const arrives = (container: HTMLElement) => !!container.querySelector('.supporter-heart-arrive');

  it('beats once per account across mounts', () => {
    expect(arrives(name('name-a').container)).toBe(true);
    cleanup();

    expect(arrives(name('name-a').container)).toBe(false);
    cleanup();

    expect(arrives(name('name-b').container)).toBe(true);
  });
});
