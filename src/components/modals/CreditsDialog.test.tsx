import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AgeGateProvider, useAgeGate } from '@/contexts/AgeGateContext';
import { UserProfileContext } from '@/contexts/userProfileStore';
import { acceptAgeGate } from '@/lib/ageGate';
import { ITEM_ICON_AUTHORS } from '@/lib/itemIcons';
import { seedTierNamesForTest } from '@/lib/tierNames';
import AgeGateService from '@/services/AgeGateService';
import AuthService from '@/services/AuthService';
import { CreditsDialog } from './CreditsDialog';

const flags = vi.hoisted(() => ({ community: true }));
vi.mock('@/lib/featureFlags', () => ({ get COMMUNITY_ENABLED() { return flags.community; } }));
// jsdom has no IndexedDB for the unanswered gate's purge to clear.
vi.mock('@/lib/communityCaches', () => ({ purgeCommunityCaches: async () => {} }));

const openProfile = vi.fn();

/** Stands in for the surfaces that raise the gate, which all sit outside this dialog. */
function GateAsker() {
  const { requireAttestation } = useAgeGate();
  return <button onClick={() => requireAttestation()}>Ask</button>;
}

const tree = (open: boolean) => (
  <AgeGateProvider>
    <UserProfileContext.Provider value={{ openProfile, setListingOpener: vi.fn() }}>
      <GateAsker />
      <CreditsDialog open={open} onOpenChange={vi.fn()} />
    </UserProfileContext.Provider>
  </AgeGateProvider>
);

const renderDialog = (open = true) => render(tree(open));

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const wallRows = [
  { id: 'id-bo', username: 'Bo', avatarUrl: null, tier: 'supporter', since: null },
  { id: 'id-zed', username: 'Zed', avatarUrl: null, tier: 'supporter_plus', since: null },
  { id: 'id-amy', username: 'Amy', avatarUrl: null, tier: 'supporter_plus', since: null },
];

const wallReads = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/patreon/supporters')).length;

const selectTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

const gatePrompt = () => screen.queryByRole('button', { name: 'Accept', hidden: true });

beforeEach(() => {
  flags.community = true;
  localStorage.clear();
  AuthService.logout();
  openProfile.mockClear();
  seedTierNamesForTest({ supporter: 'Supporter', supporter_plus: 'Supporter+', supporter_top: 'Supporter++' });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (
    String(url).endsWith('/auth/login')
      ? json({ token: 'tok', user: { id: 'u1', username: 'reader' } })
      : json({ success: true, data: wallRows })
  )));
});

afterEach(() => {
  cleanup();
  AuthService.logout();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop;
});

describe('CreditsDialog', () => {
  it('opens on the Credits tab and names every author of a shipped icon', () => {
    renderDialog();
    expect(screen.getByRole('tab', { name: 'Credits', selected: true })).toBeInTheDocument();
    const panel = screen.getByRole('tabpanel');
    for (const author of ITEM_ICON_AUTHORS) expect(panel).toHaveTextContent(author);
    expect(panel).toHaveTextContent('Jake James');
    expect(panel).toHaveTextContent('FieryLionite');
  });

  it('gives every credited name one text style', () => {
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    renderDialog();
    const names = ['Jake James', 'FieryLionite', 'llama.cpp', new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(ITEM_ICON_AUTHORS)]
      .map((name) => screen.getByText(name).className);
    expect(new Set(names).size).toBe(1);
  });

  it('links the site and the license', () => {
    renderDialog();
    expect(screen.getByRole('link', { name: 'game-icons.net' })).toHaveAttribute('href', 'https://game-icons.net');
    expect(screen.getByRole('link', { name: 'creativecommons.org/licenses/by/3.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/3.0/');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Your theme sets their colors');
  });

  it('names llama.cpp on desktop only', () => {
    const { unmount } = renderDialog();
    expect(screen.queryByText('llama.cpp')).toBeNull();
    unmount();
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    renderDialog();
    expect(screen.getByText('llama.cpp')).toBeInTheDocument();
  });

  it('stays closed until opened', () => {
    renderDialog(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the Supporters tab', () => {
  it('shows the wall in the server\'s order, with the thank-you line, once the gate is accepted', async () => {
    acceptAgeGate();
    renderDialog();
    selectTab('Supporters');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Our Supporters help fund');
    const plus = await within(panel).findByRole('region', { name: 'Supporter+' });
    expect(within(plus).getAllByRole('button').map((name) => name.textContent)).toEqual(['Zed', 'Amy']);
    expect(within(panel).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Supporter+', 'Supporter']);
  });

  it('is absent with the gate unanswered, and opening Credits raises no prompt', () => {
    renderDialog();
    expect(screen.queryByRole('tab', { name: 'Supporters' })).toBeNull();
    expect(gatePrompt()).toBeNull();
    expect(wallReads()).toBe(0);
  });

  it('appears with no reload once the gate is accepted', async () => {
    renderDialog();
    expect(screen.queryByRole('tab', { name: 'Supporters' })).toBeNull();

    fireEvent.click(screen.getByText('Ask'));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Supporters' })).toBeInTheDocument());
  });

  it('falls back to Credits when acceptance goes away while it is selected', async () => {
    acceptAgeGate();
    vi.spyOn(AgeGateService, 'read').mockReturnValue(new Promise(() => {}));
    renderDialog();
    selectTab('Supporters');
    await screen.findByRole('region', { name: 'Supporter+' });

    // An account that signs in starts unanswered, whatever this device's guest said.
    await act(async () => { await AuthService.login('reader', 'pw'); });

    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Supporters' })).toBeNull());
    expect(screen.getByRole('tab', { name: 'Credits', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Jake James');
    expect(gatePrompt()).toBeNull();
  });

  it('is absent with community off, even though the gate then reads as accepted', () => {
    flags.community = false;
    acceptAgeGate();
    renderDialog();
    expect(screen.queryByRole('tab', { name: 'Supporters' })).toBeNull();
  });

  it('titles each tier with its badge and states the tenure on the name', async () => {
    const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
    vi.mocked(fetch).mockResolvedValueOnce(json({ success: true, data: [{ ...wallRows[0], since }] }));
    acceptAgeGate();
    render(<TooltipProvider>{tree(true)}</TooltipProvider>);
    selectTab('Supporters');

    const name = await screen.findByRole('button', { name: 'Bo' });
    expect(screen.getByRole('heading', { level: 2, name: 'Supporter' })).toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel')).getAllByText('Supporter')).toHaveLength(1);

    await userEvent.hover(name);
    expect(await screen.findByText('Supporting for 1 year, 1 month')).toBeInTheDocument();
  });

  it('opens the in-app profile when a name is selected', async () => {
    acceptAgeGate();
    renderDialog();
    selectTab('Supporters');

    fireEvent.click(await screen.findByRole('button', { name: 'Zed' }));

    expect(openProfile).toHaveBeenCalledWith('id-zed', 'Zed');
  });

  it('reads the wall again each time the tab opens', async () => {
    acceptAgeGate();
    renderDialog();
    selectTab('Supporters');
    await screen.findByRole('button', { name: 'Zed' });
    expect(wallReads()).toBe(1);

    selectTab('Credits');
    selectTab('Supporters');
    await screen.findByRole('button', { name: 'Zed' });
    expect(wallReads()).toBe(2);
  });

  it('offers Try Again when the wall does not load, in the game too', async () => {
    acceptAgeGate();
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'));
    renderDialog();
    selectTab('Supporters');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the list of supporters.');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('button', { name: 'Zed' })).toBeInTheDocument();
  });

  it('holds the Patreon link on an empty wall', async () => {
    acceptAgeGate();
    vi.mocked(fetch).mockResolvedValueOnce(json({ success: true, data: [] }));
    renderDialog();
    selectTab('Supporters');

    expect(await screen.findByRole('link', { name: 'Become a Supporter' }))
      .toHaveAttribute('href', expect.stringContaining('patreon.com'));
  });

  it('starts on Credits again after the dialog closes on the Supporters tab', async () => {
    acceptAgeGate();
    const { rerender } = renderDialog();
    selectTab('Supporters');
    await screen.findByRole('button', { name: 'Zed' });

    rerender(tree(false));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    rerender(tree(true));

    expect(screen.getByRole('tab', { name: 'Credits', selected: true })).toBeInTheDocument();
  });

  it('leaves no unhandled error when the dialog closes during a read that then fails', async () => {
    acceptAgeGate();
    let fail!: (error: Error) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));
    const { rerender } = renderDialog();
    selectTab('Supporters');
    expect(screen.getByText('Loading supporters…')).toBeInTheDocument();

    rerender(tree(false));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Vitest fails the run on an unhandled rejection.
    await act(async () => { fail(new TypeError('offline')); await Promise.resolve(); });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
