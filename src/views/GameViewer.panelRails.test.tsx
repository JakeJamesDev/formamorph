import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import type { PlayerStat } from '@/types';

/** The desktop side panels collapse to rails through their edge strips, per device. */

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

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 5, regen: 0, descriptors: [] } as PlayerStat;

/** The left strip comes first in reading order, the right one last. */
const strip = async (side: 'left' | 'right', name: 'Collapse Panel' | 'Dock Panel') => {
  await screen.findByRole('button', { name: 'Hide UI' });
  const strips = screen.getAllByRole('button', { name: /^(Collapse|Dock) Panel$/ });
  expect(strips).toHaveLength(2);
  const found = side === 'left' ? strips[0] : strips[1];
  expect(found).toHaveAccessibleName(name);
  return found;
};
const rail = (name: 'Story' | 'Status') => screen.queryByRole('navigation', { name });
const railButtons = (name: 'Story' | 'Status') =>
  within(rail(name)!).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());

beforeEach(() => { device.mobile = false; });
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the left side', () => {
  it('collapses to its rail and docks again through its strip', async () => {
    renderGameViewer(harborWorld());
    expect(await screen.findByRole('tablist', { name: 'Story' })).toBeInTheDocument();
    expect(rail('Story')).toBeNull();

    fireEvent.click(await strip('left', 'Collapse Panel'));
    expect(railButtons('Story')).toEqual(['Exit to Main Menu', 'Turn Music Off', 'Entities', 'Notes', 'Memory', 'Logs']);
    expect(screen.queryByRole('tablist', { name: 'Story' })).toBeNull();
    // The other side stays docked.
    expect(screen.getByRole('tablist', { name: 'Status' })).toBeInTheDocument();

    fireEvent.click(await strip('left', 'Dock Panel'));
    expect(rail('Story')).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Story' })).toBeInTheDocument();
  });

  it('keeps Back asking before it leaves, and Music toggling, on the rail', async () => {
    const onExitToMenu = vi.fn();
    renderGameViewer(harborWorld(), { onExitToMenu });
    fireEvent.click(await strip('left', 'Collapse Panel'));
    const story = rail('Story')!;

    fireEvent.click(within(story).getByRole('button', { name: 'Turn Music Off' }));
    expect(within(story).getByRole('button', { name: 'Turn Music On' })).toBeInTheDocument();

    fireEvent.click(within(story).getByRole('button', { name: 'Exit to Main Menu' }));
    const prompt = await screen.findByRole('alertdialog', { name: 'Exit to Main Menu' });
    expect(onExitToMenu).not.toHaveBeenCalled();
    fireEvent.click(within(prompt).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onExitToMenu).toHaveBeenCalledOnce());
  });

  it('works from the keyboard', async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld());
    const collapse = await strip('left', 'Collapse Panel');

    collapse.focus();
    await user.keyboard('{Enter}');
    expect(rail('Story')).not.toBeNull();

    (await strip('left', 'Dock Panel')).focus();
    await user.keyboard(' ');
    expect(rail('Story')).toBeNull();
  });
});

describe('the right side', () => {
  it('collapses to the tabs its panel shows, with no clock or persona row', async () => {
    renderGameViewer(harborWorld({ stats: [vigor] }));
    expect(await screen.findByRole('tablist', { name: 'Status' })).toBeInTheDocument();

    fireEvent.click(await strip('right', 'Collapse Panel'));
    expect(railButtons('Status')).toEqual(['Stats', 'Traits', 'Location']);
    expect(screen.queryByRole('tablist', { name: 'Status' })).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Story' })).toBeInTheDocument();

    fireEvent.click(await strip('right', 'Dock Panel'));
    expect(rail('Status')).toBeNull();
  });

  it('leaves Stats off the rail when the panel has no Stats tab', async () => {
    renderGameViewer(harborWorld());
    fireEvent.click(await strip('right', 'Collapse Panel'));
    expect(railButtons('Status')).toEqual(['Traits', 'Location']);
  });
});

describe('the collapsed state', () => {
  it('starts docked on a fresh device', async () => {
    renderGameViewer(harborWorld());
    await strip('left', 'Collapse Panel');
    await strip('right', 'Collapse Panel');
    expect(rail('Story')).toBeNull();
    expect(rail('Status')).toBeNull();
  });

  it('survives a remount on the same device', async () => {
    const first = renderGameViewer(harborWorld());
    fireEvent.click(await strip('right', 'Collapse Panel'));
    first.unmount();

    renderGameViewer(harborWorld());
    await strip('right', 'Dock Panel');
    expect(rail('Status')).not.toBeNull();
    expect(rail('Story')).toBeNull();
  });

  it('hides with Hide UI and comes back as it was with Show UI', async () => {
    renderGameViewer(harborWorld());
    fireEvent.click(await strip('left', 'Collapse Panel'));

    fireEvent.click(screen.getByRole('button', { name: 'Hide UI' }));
    expect(rail('Story')).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Collapse|Dock) Panel$/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show UI' }));
    await strip('left', 'Dock Panel');
    await strip('right', 'Collapse Panel');
    expect(rail('Story')).not.toBeNull();
  });

  it('shows no rail or strip on mobile, even when the device has sides collapsed', async () => {
    const desktop = renderGameViewer(harborWorld());
    fireEvent.click(await strip('left', 'Collapse Panel'));
    fireEvent.click(await strip('right', 'Collapse Panel'));
    desktop.unmount();

    device.mobile = true;
    renderGameViewer(harborWorld());
    const noRails = () => {
      expect(rail('Story')).toBeNull();
      expect(rail('Status')).toBeNull();
      expect(screen.queryByRole('button', { name: /^(Collapse|Dock) Panel$/ })).toBeNull();
    };
    fireEvent.click(await screen.findByRole('button', { name: 'Story' }));
    expect(await screen.findByRole('tablist', { name: 'Story' })).toBeInTheDocument();
    noRails();
    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(await screen.findByRole('tablist', { name: 'Status' })).toBeInTheDocument();
    noRails();
  });
});

describe('the drawer', () => {
  const icon = (railName: 'Story' | 'Status', name: string) => within(rail(railName)!).getByRole('button', { name });
  const selectedTab = (list: 'Story' | 'Status') =>
    within(screen.getByRole('tablist', { name: list })).getByRole('tab', { selected: true });
  const collapse = async (side: 'left' | 'right') => fireEvent.click(await strip(side, 'Collapse Panel'));

  it('opens each left rail icon on its tab, pressed, and switches tabs without closing', async () => {
    renderGameViewer(harborWorld());
    await collapse('left');
    expect(screen.queryByRole('tablist', { name: 'Story' })).toBeNull();

    fireEvent.click(icon('Story', 'Notes'));
    expect(selectedTab('Story')).toHaveAccessibleName('Notes');
    expect(icon('Story', 'Notes')).toHaveAttribute('aria-pressed', 'true');
    // Back and Music stay on the rail; the drawer shows the panel without them.
    expect(screen.getAllByRole('button', { name: 'Exit to Main Menu' })).toHaveLength(1);

    for (const name of ['Entities', 'Memory', 'Logs']) {
      fireEvent.click(icon('Story', name));
      expect(selectedTab('Story')).toHaveAccessibleName(new RegExp(`^${name}`));
      expect(icon('Story', name)).toHaveAttribute('aria-pressed', 'true');
      expect(icon('Story', 'Notes')).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('opens each right rail icon on its tab', async () => {
    renderGameViewer(harborWorld({ stats: [vigor] }));
    await collapse('right');
    for (const name of ['Stats', 'Traits', 'Location']) {
      fireEvent.click(icon('Status', name));
      expect(selectedTab('Status')).toHaveAccessibleName(name);
      expect(icon('Status', name)).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it("moves the rail highlight with the drawer's own tab strip", async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld());
    await collapse('left');
    fireEvent.click(icon('Story', 'Notes'));

    await user.click(within(screen.getByRole('tablist', { name: 'Story' })).getByRole('tab', { name: 'Memory' }));
    expect(selectedTab('Story')).toHaveAccessibleName('Memory');
    expect(icon('Story', 'Memory')).toHaveAttribute('aria-pressed', 'true');
    expect(icon('Story', 'Notes')).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes on a second click on its icon, on Escape, and on a click on the narration', async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld());
    await collapse('left');
    const isOpen = () => screen.queryByRole('tablist', { name: 'Story' }) !== null;

    await user.click(icon('Story', 'Notes'));
    await user.click(icon('Story', 'Notes'));
    expect(isOpen()).toBe(false);
    expect(icon('Story', 'Notes')).toHaveAttribute('aria-pressed', 'false');

    await user.click(icon('Story', 'Notes'));
    await user.keyboard('{Escape}');
    expect(isOpen()).toBe(false);

    await user.click(icon('Story', 'Notes'));
    // A click inside the drawer keeps it open.
    await user.click(within(screen.getByRole('tablist', { name: 'Story' })).getByRole('tab', { name: 'Memory' }));
    expect(isOpen()).toBe(true);
    await user.click(screen.getByRole('textbox'));
    expect(isOpen()).toBe(false);
  });

  it('stays open under a dialog opened from it; Escape closes the dialog first, then the drawer', async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld());
    await collapse('right');
    await user.click(icon('Status', 'Location'));

    await user.click(screen.getByRole('button', { name: /Current Location: Harbor/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(dialog);
    // The modal hides the page behind it from assistive technology; the drawer is still there.
    expect(screen.getByRole('tablist', { name: 'Status', hidden: true })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('tablist', { name: 'Status' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tablist', { name: 'Status' })).toBeNull();
  });

  it('shows one drawer at a time', async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld());
    await collapse('left');
    await collapse('right');

    await user.click(icon('Story', 'Notes'));
    await user.click(icon('Status', 'Traits'));
    expect(screen.queryByRole('tablist', { name: 'Story' })).toBeNull();
    expect(selectedTab('Status')).toHaveAccessibleName('Traits');
    expect(icon('Story', 'Notes')).toHaveAttribute('aria-pressed', 'false');
  });

  it('stays closed after a trip to the mobile layout', async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld());
    await collapse('left');
    fireEvent.click(icon('Story', 'Notes'));

    // A tab change inside the drawer re-renders the view in the mobile layout, and a mobile tab back again.
    device.mobile = true;
    await user.click(within(screen.getByRole('tablist', { name: 'Story' })).getByRole('tab', { name: 'Memory' }));
    const gameTab = await screen.findByRole('button', { name: 'Game' });
    device.mobile = false;
    fireEvent.click(gameTab);

    expect(await strip('left', 'Dock Panel')).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Story' })).toBeNull();
    expect(icon('Story', 'Memory')).toHaveAttribute('aria-pressed', 'false');
  });

  it("docks from its strip onto the drawer's tab, on each side", async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld({ stats: [vigor] }));
    await collapse('left');
    await collapse('right');

    await user.click(icon('Story', 'Memory'));
    await user.click(await strip('left', 'Dock Panel'));
    expect(rail('Story')).toBeNull();
    expect(selectedTab('Story')).toHaveAccessibleName('Memory');

    await user.click(icon('Status', 'Location'));
    await user.click(await strip('right', 'Dock Panel'));
    expect(rail('Status')).toBeNull();
    expect(selectedTab('Status')).toHaveAccessibleName('Location');
    expect(screen.getAllByRole('tablist', { name: 'Status' })).toHaveLength(1);
  });
});
