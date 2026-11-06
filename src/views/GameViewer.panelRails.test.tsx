import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import { lastVrmViewerProps, resetVrmViewerStub, vrmViewerMounts } from '@/test/stubs/vrmViewer';
import { setUserDefaultAvatar } from '@/lib/defaultAvatar';
import ModelStorageService from '@/services/ModelStorageService';
import { makeVrm1 } from '@/test/glbFixture';
import { DEFAULT_WORLDS, seedWorldData } from '@/lib/defaultWorlds';
import sugarscape from '@/defaultworlds/sugarscape.json';
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
/** An open drawer is a region named by the tab it shows. */
const openDrawer = () => screen.queryByRole('region', { name: /^(Entities|Notes|Memory|Logs|Stats|Traits|Inventory|Location)$/ });
/** The tab a side shows: its docked tab strip's selection, else its open drawer. */
const selectedTab = (list: 'Story' | 'Status') => {
  const tabs = screen.queryByRole('tablist', { name: list });
  return tabs ? within(tabs).getByRole('tab', { selected: true }) : openDrawer()!;
};
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

  it('shows no tab strip of its own; the rail switches its tabs', async () => {
    renderGameViewer(harborWorld({ stats: [vigor] }));
    await collapse('left');
    await collapse('right');
    fireEvent.click(icon('Story', 'Notes'));
    expect(screen.queryByRole('tablist', { name: 'Story' })).toBeNull();
    fireEvent.click(icon('Status', 'Traits'));
    expect(screen.queryByRole('tablist', { name: 'Status' })).toBeNull();
    expect(openDrawer()).toHaveAccessibleName('Traits');
  });

  it('closes on a second click on its icon, on Escape, and on a click on the narration', async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld());
    await collapse('left');
    const isOpen = () => openDrawer() !== null;

    await user.click(icon('Story', 'Notes'));
    await user.click(icon('Story', 'Notes'));
    expect(isOpen()).toBe(false);
    expect(icon('Story', 'Notes')).toHaveAttribute('aria-pressed', 'false');

    await user.click(icon('Story', 'Notes'));
    await user.keyboard('{Escape}');
    expect(isOpen()).toBe(false);

    await user.click(icon('Story', 'Notes'));
    // A click inside the drawer keeps it open.
    await user.click(openDrawer()!);
    expect(isOpen()).toBe(true);
    // The narration's action box, not the Notes box inside the drawer.
    await user.click(screen.getAllByRole('textbox').find((box) => !openDrawer()!.contains(box))!);
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
    expect(screen.getByRole('region', { name: 'Location', hidden: true })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(openDrawer()).toHaveAccessibleName('Location');

    await user.keyboard('{Escape}');
    expect(openDrawer()).toBeNull();
  });

  it('shows one drawer at a time', async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld());
    await collapse('left');
    await collapse('right');

    await user.click(icon('Story', 'Notes'));
    await user.click(icon('Status', 'Traits'));
    expect(screen.getAllByRole('region', { name: /^(Notes|Traits)$/ })).toHaveLength(1);
    expect(selectedTab('Status')).toHaveAccessibleName('Traits');
    expect(icon('Story', 'Notes')).toHaveAttribute('aria-pressed', 'false');
  });

  it('stays closed after a trip to the mobile layout', async () => {
    const user = userEvent.setup();
    renderGameViewer(harborWorld());
    await collapse('left');
    fireEvent.click(icon('Story', 'Notes'));

    // A tab change from the rail re-renders the view in the mobile layout, and a mobile tab back again.
    device.mobile = true;
    await user.click(icon('Story', 'Memory'));
    const gameTab = await screen.findByRole('button', { name: 'Game' });
    device.mobile = false;
    fireEvent.click(gameTab);

    expect(await strip('left', 'Dock Panel')).toBeInTheDocument();
    expect(openDrawer()).toBeNull();
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

describe('the Entity View model', () => {
  it('loads once through collapse, the drawer opening and closing, and docking', async () => {
    resetVrmViewerStub();
    // The player's own Avatar, set as the device default, is what the Entity View shows.
    const added = await ModelStorageService.addModel(new File([makeVrm1({ name: 'Mine' })], 'mine.vrm', { type: 'model/vrm' }));
    setUserDefaultAvatar(added.id);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mine', revokeObjectURL: () => undefined }));
    const user = userEvent.setup();
    renderGameViewer(seedWorldData(sugarscape as unknown as Record<string, unknown>, DEFAULT_WORLDS.find(({ id }) => id === 'sugarscape')!));
    const readme = await screen.findByRole('dialog', { name: 'Readme' });
    fireEvent.click(within(readme).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Readme' })).toBeNull());
    // The viewer is keyed on its file, so it mounts again once the Avatar resolves; count from there.
    await waitFor(() => expect(lastVrmViewerProps()?.modelUrl).toBe('blob:mine'));
    const loaded = vrmViewerMounts.count;

    await user.click(await strip('left', 'Collapse Panel'));
    await user.click(within(rail('Story')!).getByRole('button', { name: 'Notes' }));
    expect(openDrawer()).toHaveAccessibleName('Notes');
    await user.keyboard('{Escape}');
    expect(openDrawer()).toBeNull();
    await user.click(within(rail('Story')!).getByRole('button', { name: 'Memory' }));
    await user.click(await strip('left', 'Dock Panel'));

    expect(screen.getByTestId('vrm-viewer')).toBeVisible();
    expect(vrmViewerMounts.count).toBe(loaded);
  });
});

describe('a surface request into a side', () => {
  const enter = async () => {
    const requester = createSurfaceRequester();
    renderGameViewer(harborWorld({ stats: [vigor] }), { children: <requester.Requester /> });
    await screen.findByRole('button', { name: 'Hide UI' });
    return requester;
  };
  const collapse = async (side: 'left' | 'right') => fireEvent.click(await strip(side, 'Collapse Panel'));

  it('opens the left drawer on the requested tab when the left side is collapsed', async () => {
    const requester = await enter();
    await collapse('left');
    requester.send('gameViewer.memory');
    expect(await screen.findByRole('region', { name: 'Memory' })).toBeInTheDocument();
    expect(selectedTab('Story')).toHaveAccessibleName(/^Memory/);
  });

  it('opens the right drawer on the requested tab when the right side is collapsed', async () => {
    const requester = await enter();
    await collapse('right');
    requester.send('gameViewer.traits');
    expect(await screen.findByRole('region', { name: 'Traits' })).toBeInTheDocument();
    expect(selectedTab('Status')).toHaveAccessibleName('Traits');
  });

  it('opens the drawer again for a repeat request after it was closed', async () => {
    const user = userEvent.setup();
    const requester = await enter();
    await collapse('left');
    requester.send('gameViewer.memory');
    await screen.findByRole('region', { name: 'Memory' });
    await user.keyboard('{Escape}');
    expect(openDrawer()).toBeNull();

    requester.send('gameViewer.memory');
    expect(await screen.findByRole('region', { name: 'Memory' })).toBeInTheDocument();
    expect(selectedTab('Story')).toHaveAccessibleName(/^Memory/);
  });

  it('selects the tab in a docked panel, left or right, and opens no drawer', async () => {
    const requester = await enter();
    await screen.findByRole('tablist', { name: 'Status' });
    requester.send('gameViewer.traits');
    await waitFor(() => expect(selectedTab('Status')).toHaveAccessibleName('Traits'));
    requester.send('gameViewer.memory');
    await waitFor(() => expect(selectedTab('Story')).toHaveAccessibleName(/^Memory/));
    expect(rail('Story')).toBeNull();
    expect(rail('Status')).toBeNull();
  });

  it('selects a docked left tab without opening the collapsed right side', async () => {
    const requester = await enter();
    await collapse('right');
    requester.send('gameViewer.notes');
    await waitFor(() => expect(selectedTab('Story')).toHaveAccessibleName('Notes'));
    expect(rail('Status')).not.toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Status' })).toBeNull();
  });
});
