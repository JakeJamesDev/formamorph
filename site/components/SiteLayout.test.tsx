import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthService from '@/services/AuthService';
import { resetAccountPage, signIn } from '../test/support';
import { SiteLayout } from './SiteLayout';

const renderPage = () => render(<SiteLayout><p>Page body</p></SiteLayout>);

/** A write made in another tab, after its localStorage change has already landed. */
const foreignWrite = (key: string, value: string | null) => {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
};

beforeEach(() => resetAccountPage('/u/rowan'));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the shared site account controls', () => {
  it('offers sign in when there is no session', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();
  });

  it('keeps profile, account settings, and sign out visible for a signed-in reader', () => {
    signIn({ username: 'rowan', avatarUrl: '/api/avatars/rowan.webp' });
    renderPage();

    const profile = screen.getByRole('link', { name: 'Profile' });
    expect(profile).toHaveAttribute('href', '/u/rowan');
    expect(within(profile).getByRole('img', { name: 'rowan' }))
      .toHaveAttribute('src', 'https://api.formamorph.ai/api/avatars/rowan.webp');
    expect(screen.getByRole('link', { name: 'Account Settings' })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  });

  it('signs out through the shared session and updates this page immediately', async () => {
    signIn({ username: 'rowan' });
    renderPage();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign Out' }));

    expect(AuthService.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(AuthService.tokenKey)).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  it('follows a foreign sign-in and avatar update without reloading', () => {
    renderPage();

    act(() => {
      localStorage.setItem(AuthService.tokenKey, 'foreign-token');
      localStorage.setItem(AuthService.userKey, JSON.stringify({ username: 'rowan' }));
      foreignWrite(AuthService.tokenKey, 'foreign-token');
    });
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/u/rowan');

    act(() => {
      localStorage.setItem(AuthService.userKey, JSON.stringify({
        username: 'rowan',
        avatarUrl: '/api/avatars/new.webp',
      }));
      foreignWrite(AuthService.userKey, localStorage.getItem(AuthService.userKey));
    });

    expect(within(screen.getByRole('link', { name: 'Profile' })).getByRole('img', { name: 'rowan' }))
      .toHaveAttribute('src', 'https://api.formamorph.ai/api/avatars/new.webp');
  });

  it('follows a foreign sign-out', () => {
    signIn({ username: 'rowan' });
    renderPage();

    act(() => {
      localStorage.removeItem(AuthService.tokenKey);
      localStorage.removeItem(AuthService.userKey);
      foreignWrite(AuthService.tokenKey, null);
    });

    expect(screen.getByRole('link', { name: 'Sign In' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull();
  });
});
