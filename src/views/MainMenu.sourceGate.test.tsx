import { screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import WorldStorageService from '@/services/WorldStorageService';
import AuthService from '@/services/AuthService';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { writeSourceCheck } from '@/lib/sourceCheckStore';
import type { SourceCheckStatus } from '@/lib/sourceChecks';
import type { StoredWorldRecord } from '@/services/WorldStorageService';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

/** A world holding one copy that follows a published source. */
const world = (): StoredWorldRecord => ({
  id: 'gated-world', name: 'Gated World',
  data: {
    version: __APP_VERSION__,
    worldOverview: { name: 'Gated World', description: '', author: '', systemPrompt: '', tags: [] },
    stats: [], statUpdates: [], traits: [], dictionaries: [],
    locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }],
    entities: [{
      id: 'e1', name: 'Warden', playerDescription: '', aiDescription: '', aiSummary: '',
      link: { libraryId: 'lib-a', sourceId: 'src-a', sourceName: 'Marsh Warden' },
    }],
  },
} as unknown as StoredWorldRecord);

/** Record the answer a check in the World Editor would have left behind. */
const recordCheck = (status: SourceCheckStatus, required = ['src-a']) =>
  writeSourceCheck('gated-world', {
    checkedAt: '2026-09-13T10:00:00.000Z', results: { 'src-a': status }, required,
  });

let requests: ReturnType<typeof vi.fn>;

/** Sign in, which is what puts Publish World in the world's action column. */
const signIn = () => {
  const user = { id: 'me', username: 'Fen' };
  vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(user as never);
  vi.spyOn(AuthService, 'fetchUserProfile').mockResolvedValue(user as never);
};

const openWorld = async () => {
  renderMainMenu();
  fireEvent.click(await screen.findByText('Gated World'));
  await screen.findByRole('button', { name: /Enter World/ });
};

beforeEach(async () => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  requests = vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', requests);
  await WorldStorageService.storeWorld(world());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('a world whose required source was removed', () => {
  it('stops a new game and says why', async () => {
    recordCheck('not_found');
    await openWorld();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This world requires a source its author removed: Marsh Warden.',
    );
    expect(screen.getByRole('button', { name: /Enter World/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Quick Start/ })).toBeDisabled();
  });

  it('leaves every other action alone, editing above all — the repair lives there', async () => {
    recordCheck('not_found');
    await openWorld();

    for (const name of [/Edit World/, /Duplicate World/, /Export World/]) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
  });

  it('leaves resuming a save alone, which keeps what it started with', async () => {
    recordCheck('not_found');
    await openWorld();

    // Load Game lives in the menu popover, which only mounts once opened — and the world window has to be
    // out of the way first, since Radix hides the rest of the tree while it is up.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    // Both viewport branches render under jsdom, which has no CSS to hide either; each has its own trigger.
    for (const trigger of await screen.findAllByRole('button', { name: 'Menu' })) fireEvent.click(trigger);

    const resume = await screen.findAllByRole('button', { name: /Load Game/ });
    for (const button of resume) expect(button).toBeEnabled();
  });

  it('offers the way to the repair from the blocked action itself', async () => {
    recordCheck('not_found');
    await openWorld();

    fireEvent.click(screen.getByRole('button', { name: 'Repair Sources' }));
    expect(await screen.findByRole('button', { name: /^Test Bench/ })).toBeInTheDocument();
  });

  it('gates only the actions that need the source, and nothing else in the column', async () => {
    recordCheck('not_found');
    await openWorld();

    const disabled = screen.getAllByRole('button')
      .filter((button) => button.hasAttribute('disabled'))
      .map((button) => button.textContent?.trim());
    expect(disabled).toEqual(['Enter World', 'Quick Start']);
  });

  it('starts a new game once the copy no longer follows the removed source', async () => {
    recordCheck('not_found');
    const repaired = world();
    delete (repaired.data as { entities: { link?: unknown }[] }).entities[0].link;
    await WorldStorageService.storeWorld(repaired);
    await openWorld();

    await waitFor(() => expect(screen.getByRole('button', { name: /Enter World/ })).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('publishing a world whose required source was removed', () => {
  it('is blocked for the same reason a new game is', async () => {
    signIn();
    recordCheck('not_found');
    await openWorld();

    await waitFor(() => expect(screen.getByRole('button', { name: /Publish World/ })).toBeDisabled());
  });

  it('is allowed once the copy no longer follows the removed source', async () => {
    signIn();
    recordCheck('not_found');
    const repaired = world();
    delete (repaired.data as { entities: { link?: unknown }[] }).entities[0].link;
    await WorldStorageService.storeWorld(repaired);
    await openWorld();

    await waitFor(() => expect(screen.getByRole('button', { name: /Publish World/ })).toBeEnabled());
  });
});

describe('a world whose source check could not reach the server', () => {
  it('starts a new game, because a failed check is not evidence of a deletion', async () => {
    recordCheck('unavailable');
    await openWorld();

    expect(screen.getByRole('button', { name: /Enter World/ })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('a world whose removed source is optional', () => {
  it('blocks nothing', async () => {
    recordCheck('not_found', []);
    await openWorld();

    expect(screen.getByRole('button', { name: /Enter World/ })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('a world nobody has checked', () => {
  it('starts a new game, because opening the menu asks the server nothing', async () => {
    await openWorld();

    expect(screen.getByRole('button', { name: /Enter World/ })).toBeEnabled();
    expect(requests.mock.calls.some(([url]) => String(url).includes('/worlds/src-a'))).toBe(false);
  });
});
