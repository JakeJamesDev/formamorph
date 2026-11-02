import { screen, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { renderMainMenu } from '@/test/mainMenu';
import { DEFAULT_WORLDS, tombstoneDefaultWorld } from '@/lib/defaultWorlds';
import { acceptAgeGate } from '@/lib/ageGate';
import { ITEM_ICON_AUTHORS } from '@/lib/itemIcons';

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));
vi.mock('./VRMViewer', async () => {
  const { forwardRef } = await import('react');
  return { default: forwardRef(() => null) };
});

vi.mock('@/services/ModelStorageService', () => ({
  default: {
    initialize: vi.fn(async () => {}),
    seedBundledAvatars: vi.fn(async () => {}),
    getModelMetadata: vi.fn(async () => []),
    ensureThumbnail: vi.fn(async () => null),
    getModelData: vi.fn(async () => null),
    bundledAvatarHashes: vi.fn(async () => []),
  },
}));

const realMatchMedia = window.matchMedia;
const realWidth = window.innerWidth;

beforeEach(() => {
  localStorage.clear();
  DEFAULT_WORLDS.forEach(({ id }) => tombstoneDefaultWorld(id));
  acceptAgeGate();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
  window.innerWidth = realWidth;
});

/** A phone-width window: useIsMobile reads both the width and the media query. */
function goMobile() {
  window.innerWidth = 375;
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe('the Credits line on the Main Menu', () => {
  it('opens the Credits dialog from the footer', async () => {
    renderMainMenu();
    fireEvent.click(await screen.findByRole('button', { name: 'Credits' }));
    const dialog = await screen.findByRole('dialog', { name: 'Credits' });
    for (const author of ITEM_ICON_AUTHORS) expect(dialog).toHaveTextContent(author);
  });

  it('opens the same dialog from the ⋯ menu on mobile', async () => {
    goMobile();
    renderMainMenu();
    fireEvent.click(await screen.findByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Credits' }));
    expect(await screen.findByRole('dialog', { name: 'Credits' })).toBeInTheDocument();
  });

  it('opens the profile dialog over Credits when a name on the Supporters tab is selected', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => new Response(JSON.stringify({
      data: String(url).endsWith('/patreon/supporters')
        ? [{ id: 'id-zed', username: 'Zed', avatarUrl: null, tier: 'supporter', since: null }]
        : [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderMainMenu();
    fireEvent.click(await screen.findByRole('button', { name: 'Credits' }));
    await screen.findByRole('dialog', { name: 'Credits' });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Supporters' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Zed' }));

    expect(await screen.findByRole('dialog', { name: /Zed/ })).toBeInTheDocument();
  });
});
