import { screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import WorldStorageService from '@/services/WorldStorageService';
import AuthService from '@/services/AuthService';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import type { StoredWorldRecord } from '@/services/WorldStorageService';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

const supporterCopy = { listingId: 'listing-1', accountId: 'me', revision: 1 };

const world = (name: string, marker?: typeof supporterCopy): StoredWorldRecord => ({
  id: name.toLowerCase().replace(/ /g, '-'), name,
  ...(marker ? { supporterCopy: marker, sourceId: marker.listingId } : {}),
  data: {
    version: __APP_VERSION__,
    worldOverview: { name, description: '', author: '', systemPrompt: '', tags: [] },
    stats: [], statUpdates: [], traits: [], dictionaries: [], entities: [],
    locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }],
  },
} as unknown as StoredWorldRecord);

const BLOCKED = [
  [/Duplicate World/, "You can't duplicate a Supporter world"],
  [/Export World/, "You can't export a Supporter world"],
  [/Publish World/, "You can't publish a Supporter world"],
] as const;

const openWorld = async (name: string) => {
  renderMainMenu();
  fireEvent.click(await screen.findByText(name));
  await screen.findByRole('button', { name: /Enter World/ });
};

beforeEach(async () => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
  const user = { id: 'me', username: 'Fen' };
  vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(user as never);
  vi.spyOn(AuthService, 'fetchUserProfile').mockResolvedValue(user as never);
  for (const id of ['supporter-fen', 'plain-fen']) await WorldStorageService.deleteWorld(id).catch(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('a Supporter Copy in the Main Menu', () => {
  it.each(BLOCKED)('shows %s disabled, with the reason as its tooltip', async (name, reason) => {
    await WorldStorageService.storeWorld(world('Supporter Fen', supporterCopy));
    await openWorld('Supporter Fen');

    const button = await waitFor(() => {
      const found = screen.getByRole('button', { name });
      expect(found).toBeDisabled();
      return found;
    });
    await userEvent.hover(button.parentElement!);
    expect(await screen.findByText(reason, { selector: 'div' })).toBeInTheDocument();
  });

  it('keeps Enter World and Edit World', async () => {
    await WorldStorageService.storeWorld(world('Supporter Fen', supporterCopy));
    await openWorld('Supporter Fen');

    expect(screen.getByRole('button', { name: /Enter World/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Edit World/ })).toBeEnabled();
  });

  it('leaves a plain world’s actions enabled', async () => {
    await WorldStorageService.storeWorld(world('Plain Fen'));
    await openWorld('Plain Fen');

    for (const [name] of BLOCKED) await waitFor(() => expect(screen.getByRole('button', { name })).toBeEnabled());
  });

  it('marks only the Supporter Copy’s card with the Patreon heart, with its tooltip', async () => {
    await WorldStorageService.storeWorld(world('Supporter Fen', supporterCopy));
    await WorldStorageService.storeWorld(world('Plain Fen'));
    renderMainMenu();
    await screen.findByText('Plain Fen');

    const marks = await screen.findAllByRole('img', { name: 'Supporter world' });
    expect(marks).toHaveLength(1);
    expect(marks[0].closest('[data-world-card], [role="button"]')?.textContent).toContain('Supporter Fen');
    await userEvent.hover(marks[0]);
    expect(await screen.findByText('Supporter world. You can play and edit it, but not export or share it.', { selector: 'div' })).toBeInTheDocument();
  });
});
