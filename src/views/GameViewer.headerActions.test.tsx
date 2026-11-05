import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import AuthService from '@/services/AuthService';

/** The game's direct header buttons, the left panel's row, and the mobile menu that keeps them all. */

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const device = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/lib/useIsMobile', async (original) => ({
  ...(await original<typeof import('@/lib/useIsMobile')>()),
  useIsMobile: () => device.mobile,
}));

const button = (name: string) => screen.findByRole('button', { name });
const signIn = () => { AuthService.token = 'token'; };

/** The labels of the open menu's items, in order. */
const openMenuItems = async () => {
  fireEvent.click(await button('More Actions'));
  const first = await button('AI Context');
  const items = first.parentElement;
  if (!items) throw new Error('The menu has no item list');
  return within(items).getAllByRole('button').map((item) => item.textContent?.trim());
};

beforeEach(() => { device.mobile = false; });
afterEach(() => {
  AuthService.token = null;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the desktop header', () => {
  it('opens Save Game and Load Game each from its own half, in one click', async () => {
    renderGameViewer(harborWorld());

    fireEvent.click(await button('Save Game'));
    expect(await screen.findByRole('dialog', { name: 'Save Game' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Save Game' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Save Game' })).toBeNull());

    fireEvent.click(await button('Load Game'));
    expect(await screen.findByRole('dialog', { name: 'Load Game' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Save Game' })).toBeNull();
  });

  it('opens Settings in one click', async () => {
    renderGameViewer(harborWorld());
    fireEvent.click(await button('Settings'));
    const settings = await screen.findByRole('dialog', { name: 'Settings' });
    fireEvent.keyDown(settings, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull());
  });

  it('holds only Edit World, AI Context and Send Feedback in the menu when signed in', async () => {
    signIn();
    renderGameViewer(harborWorld());
    expect(await openMenuItems()).toEqual(['Edit World', 'AI Context', 'Send Feedback']);
  });

  it('leaves Send Feedback out when signed out', async () => {
    renderGameViewer(harborWorld());
    expect(await openMenuItems()).toEqual(['Edit World', 'AI Context']);
  });

  it('opens AI Context from the menu', async () => {
    renderGameViewer(harborWorld());
    fireEvent.click(await button('More Actions'));
    fireEvent.click(await button('AI Context'));
    expect(await screen.findByRole('dialog', { name: /AI Context/ })).toBeInTheDocument();
  });
});

describe('the left panel row', () => {
  it('asks before leaving, and Cancel keeps the game running', async () => {
    const onExitToMenu = vi.fn();
    renderGameViewer(harborWorld(), { onExitToMenu });

    fireEvent.click(await button('Exit to Main Menu'));
    const prompt = await screen.findByRole('alertdialog', { name: 'Exit to Main Menu' });
    fireEvent.click(within(prompt).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onExitToMenu).not.toHaveBeenCalled();
    expect(await button('Save Game')).toBeInTheDocument();
  });

  it('leaves once confirmed', async () => {
    const onExitToMenu = vi.fn();
    renderGameViewer(harborWorld(), { onExitToMenu });

    fireEvent.click(await button('Exit to Main Menu'));
    const prompt = await screen.findByRole('alertdialog', { name: 'Exit to Main Menu' });
    fireEvent.click(within(prompt).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(onExitToMenu).toHaveBeenCalledOnce());
  });

  it('names the music button by what it will do, and changes the icon and color with it', async () => {
    renderGameViewer(harborWorld());
    const icon = (control: HTMLElement) => control.querySelector('svg');

    const on = await button('Turn Music Off');
    const onIcon = icon(on)?.innerHTML;
    expect(icon(on)).not.toHaveClass('text-muted-foreground');

    fireEvent.click(on);
    const off = await button('Turn Music On');
    expect(icon(off)?.innerHTML).not.toBe(onIcon);
    expect(icon(off)).toHaveClass('text-muted-foreground');

    fireEvent.click(off);
    expect(await button('Turn Music Off')).toBeInTheDocument();
  });
});

describe('mobile', () => {
  beforeEach(() => { device.mobile = true; });

  it('keeps every action in its single menu, in order', async () => {
    signIn();
    renderGameViewer(harborWorld());
    expect(await openMenuItems()).toEqual([
      'Save Game', 'Load Game', 'Edit World', 'AI Context', 'Settings', 'Send Feedback', 'Exit to Main Menu',
    ]);
  });

  it('shows no direct header button or left panel row', async () => {
    renderGameViewer(harborWorld());
    await button('More Actions');
    for (const name of ['Save Game', 'Load Game', 'Settings', 'Exit to Main Menu', 'Turn Music Off']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('asks before leaving from the menu', async () => {
    renderGameViewer(harborWorld());
    fireEvent.click(await button('More Actions'));
    fireEvent.click(await button('Exit to Main Menu'));
    expect(await screen.findByRole('alertdialog', { name: 'Exit to Main Menu' })).toBeInTheDocument();
  });
});
