import { screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import { stubReducedMotion } from '@/test/reducedMotion';
import { frames, recordScrolls, rowOf } from '@/test/landing';
import { LANDING_PULSE_CLASS, LANDING_RING_CLASS } from '@/lib/landingPulse';
import { routeText } from '@/lib/surface/surfaceTargets';
import WorldStorageService, { type StoredWorldRecord } from '@/services/WorldStorageService';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';

/** Take Me There landing on the main menu: a request that names a row opens its tab or dialog, then points at it. */

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

const world = (): StoredWorldRecord => ({
  id: 'sedge', name: 'Sedge Landing',
  data: {
    version: __APP_VERSION__,
    worldOverview: { name: 'Sedge Landing', description: '', author: '', systemPrompt: '', tags: [] },
    stats: [], statUpdates: [], traits: [], dictionaries: [], entities: [],
    locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }],
  },
} as unknown as StoredWorldRecord);

let requester: ReturnType<typeof createSurfaceRequester>;
const scrolled = recordScrolls();

beforeEach(async () => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
  await WorldStorageService.storeWorld(world());
  requester = createSurfaceRequester();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderMenu = async () => {
  renderMainMenu({}, { children: <requester.Requester /> });
  await screen.findByText('Sedge Landing');
};

/** The route's row, once the landing has reached it. */
const landed = async (route: string) => {
  await waitFor(() => expect(scrolled).toContain(rowOf(route)));
  return rowOf(route)!;
};

describe('Take Me There landing on the main menu', () => {
  it.each([
    ['mainMenu.worlds', 'import-world'],
    ['mainMenu.entities', 'import-entity'],
    ['mainMenu.dictionaries', 'import-dictionary'],
    ['mainMenu.models', 'import-avatar'],
  ] as const)('opens the tab of %s and lands on %s', async (surface, target) => {
    await renderMenu();
    requester.send(surface, target);
    const button = await landed(routeText(surface, target));
    expect(button).toHaveTextContent(/^Import /);
    expect(document.activeElement).toBe(button);
    expect(button).toHaveClass(LANDING_PULSE_CLASS);
  });

  it('takes the pulse off when the animation ends, and draws a still ring under reduced motion', async () => {
    stubReducedMotion();
    await renderMenu();
    requester.send('mainMenu.models', 'import-avatar');
    const button = await landed('mainMenu.models#import-avatar');
    expect(button).toHaveClass(LANDING_RING_CLASS);
    expect(button).not.toHaveClass(LANDING_PULSE_CLASS);
  });

  it('lands in the Backup & Restore dialog once it has opened', async () => {
    await renderMenu();
    requester.send('backup', 'start-restore');
    const button = await landed('backup#start-restore');
    expect(button).toHaveTextContent('Restore');
    expect(document.activeElement).toBe(button);
    expect(button).toHaveClass(LANDING_PULSE_CLASS);
    expect(rowOf('backup#start-backup')).not.toHaveClass(LANDING_PULSE_CLASS);
  });

  it('lands on the Import button of the Load Game dialog', async () => {
    await renderMenu();
    requester.send('menu', 'import-save');
    const button = await landed('menu#import-save');
    expect(button).toHaveTextContent('Import');
    expect(document.activeElement).toBe(button);
  });

  it('lands on Finalize Character in Character Customization', async () => {
    await renderMenu();
    requester.send('avatar', 'finalize-character');
    const button = await landed('avatar#finalize-character');
    expect(button).toHaveTextContent('Finalize Character');
    expect(document.activeElement).toBe(button);
  });

  it('lands again on a repeat request for the same target', async () => {
    await renderMenu();
    requester.send('mainMenu.worlds', 'import-world');
    const button = await landed('mainMenu.worlds#import-world');
    button.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: LANDING_PULSE_CLASS }));
    expect(button).not.toHaveClass(LANDING_PULSE_CLASS);

    requester.send('mainMenu.worlds', 'import-world');
    await waitFor(() => expect(scrolled).toHaveLength(2));
    expect(scrolled[1]).toBe(button);
    expect(button).toHaveClass(LANDING_PULSE_CLASS);
  });

  it('leaves the surface open with no error and no pulse when the row is not on the page', async () => {
    const errors = vi.spyOn(console, 'error');
    await renderMenu();
    // The browser build has no update bridge, so the footer holds no app-version control.
    requester.send('mainMenu', 'app-version');
    await frames(32);
    expect(rowOf('mainMenu#app-version')).toBeNull();
    expect(scrolled).toEqual([]);
    expect(document.querySelector(`.${LANDING_PULSE_CLASS}`)).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  it('leaves a Settings row to Settings, which lands once', async () => {
    await renderMenu();
    requester.send('settingsEndpoints.text', 'text-preset');
    const row = await landed('settingsEndpoints.text#text-preset');
    await frames(8);
    expect(scrolled.filter((element) => element === row)).toHaveLength(1);
    expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(1);
  });

  it('lands only on the row of the surface it names', async () => {
    await renderMenu();
    // Both tabs offer an Import button; only the Avatars one is the request's row.
    requester.send('mainMenu.models', 'import-avatar');
    await landed('mainMenu.models#import-avatar');
    expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(1);
    expect(rowOf('mainMenu.worlds#import-world')).toBeNull();
  });
});
