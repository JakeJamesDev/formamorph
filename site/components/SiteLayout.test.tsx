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

beforeEach(() => { resetAccountPage('/u/rowan'); document.documentElement.className = 'light'; });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the shared site account controls', () => {
  it('offers sign in when there is no session', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Community' })).toHaveAttribute('href', '/community');
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();
  });

  it('opens account options from the avatar and restores focus on Escape', async () => {
    signIn({ username: 'rowan', avatarUrl: '/api/avatars/rowan.webp' });
    renderPage();

    const user = userEvent.setup();
    const avatar = screen.getByRole('button', { name: 'Account menu' });
    expect(screen.queryByRole('link', { name: 'Account Settings' })).toBeNull();
    expect(within(avatar).getByRole('img', { name: 'rowan' }))
      .toHaveAttribute('src', 'https://api.formamorph.ai/api/avatars/rowan.webp');
    await user.click(avatar);
    const profile = screen.getByRole('link', { name: 'Profile' });
    expect(profile).toHaveAttribute('href', '/u/rowan');
    expect(screen.getByRole('link', { name: 'Account Settings' })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: 'Account Settings' })).toBeNull();
    expect(avatar).toHaveFocus();
  });

  it('signs out through the shared session and updates this page immediately', async () => {
    signIn({ username: 'rowan' });
    renderPage();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));

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
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeVisible();

    act(() => {
      localStorage.setItem(AuthService.userKey, JSON.stringify({
        username: 'rowan',
        avatarUrl: '/api/avatars/new.webp',
      }));
      foreignWrite(AuthService.userKey, localStorage.getItem(AuthService.userKey));
    });

    expect(within(screen.getByRole('button', { name: 'Account menu' })).getByRole('img', { name: 'rowan' }))
      .toHaveAttribute('src', 'https://api.formamorph.ai/api/avatars/new.webp');
  });

  it('switches appearance in place and remembers both choices across mounts', async () => {
    signIn({ username: 'rowan' });
    const view = renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
    expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    view.unmount();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('vite-ui-theme')).toBe('light');
    expect(screen.getByRole('link', { name: 'Profile' })).toBeVisible();
  });

  it('reflects external theme changes and still switches when storage is refused', async () => {
    signIn({ username: 'rowan' });
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    await act(async () => { foreignWrite('vite-ui-theme', 'dark'); });
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage denied'); });
    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement).toHaveClass('light');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps System selected while following device colors, and ignores unrelated storage', async () => {
    signIn({ username: 'rowan' });
    const media = new EventTarget();
    Object.assign(media, { matches: true, media: '(prefers-color-scheme: dark)' });
    vi.stubGlobal('matchMedia', () => media);
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveClass('dark');
    await act(async () => {
      media.dispatchEvent(Object.assign(new Event('change'), { matches: false }));
      foreignWrite('unrelated', 'dark');
    });
    expect(document.documentElement).toHaveClass('light');
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Dark' }));
    await user.click(screen.getByRole('button', { name: 'System' }));
    expect(localStorage.getItem('vite-ui-theme')).toBe('system');
    await act(async () => { foreignWrite('vite-ui-theme', null); });
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('follows a foreign sign-out'  , () => {
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
