import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { UserName } from './UserName';
import { UserProfileContext } from '@/contexts/userProfileStore';

afterEach(cleanup);

const show = (props: Record<string, unknown>, openProfile = vi.fn()) => {
  render(
    <UserProfileContext.Provider value={{ openProfile }}>
      <UserName {...props} />
    </UserProfileContext.Provider>
  );
  return openProfile;
};

describe('a name with an account behind it', () => {
  it('opens their profile when clicked', () => {
    const openProfile = show({ userId: 'u1', username: 'wren_hallow' });

    fireEvent.click(screen.getByRole('button', { name: "View wren_hallow's profile" }));

    expect(openProfile).toHaveBeenCalledWith('u1', 'wren_hallow');
  });

  it('does not also trigger whatever it sits inside', () => {
    // These names live in cards and rows that are themselves clickable.
    const onRowClick = vi.fn();
    render(
      <UserProfileContext.Provider value={{ openProfile: vi.fn() }}>
        <button onClick={onRowClick}>
          <UserName userId="u1" username="wren_hallow" />
        </button>
      </UserProfileContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: "View wren_hallow's profile" }));

    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('a name with nothing behind it', () => {
  it('is plain text when the account is gone', () => {
    // A comment outlives its author; a control that opens nothing reads as broken.
    show({ userId: null, username: 'wren_hallow' });

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('wren_hallow')).toBeTruthy();
  });

  it('falls back to a word rather than an empty byline', () => {
    show({ userId: 'u1', username: null });

    expect(screen.getByText('Unknown')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('takes the caller’s own wording for that', () => {
    show({ userId: null, username: null, fallback: 'A deleted account' });

    expect(screen.getByText('A deleted account')).toBeTruthy();
  });
});

describe('the staff badge', () => {
  it('says they are on the team', () => {
    show({ userId: 'u1', username: 'wren_hallow', role: 'mod' });

    expect(screen.getByText('Mod')).toBeTruthy();
  });

  it('is absent for an ordinary account', () => {
    show({ userId: 'u1', username: 'wren_hallow', role: null });

    expect(screen.queryByText(/^(Mod|Dev|Admin)$/)).toBeNull();
  });

  it('stays outside the control, so the label is only where the click goes', () => {
    // "Mod View wren_hallow's profile" is one thing said by a screen reader, and it is two things.
    show({ userId: 'u1', username: 'wren_hallow', role: 'admin' });

    expect(screen.getByRole('button').textContent).toBe('wren_hallow');
    expect(screen.getByText('Admin')).toBeTruthy();
  });

  it('shows on a name with no account behind it', () => {
    // Staff leave replies that outlive their accounts; the badge is about the words, not the link.
    show({ userId: null, username: 'osk_tinder', role: 'dev' });

    expect(screen.getByText('Dev')).toBeTruthy();
  });
});

describe('outside a provider', () => {
  it('still renders, and clicking it does nothing', () => {
    // A panel rendered in isolation should mount; a name that opens no dialog is the smaller failure.
    render(<UserName userId="u1" username="wren_hallow" />);

    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });
});
