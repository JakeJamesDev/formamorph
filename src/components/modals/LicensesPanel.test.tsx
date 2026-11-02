import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AgeGateProvider } from '@/contexts/AgeGateContext';
import { UserProfileContext } from '@/contexts/userProfileStore';
import { parseNotices, SUMMARY_SECTION } from '@/lib/noticesFormat';
import { CreditsDialog } from './CreditsDialog';

vi.mock('@/lib/featureFlags', () => ({ COMMUNITY_ENABLED: false }));

const NOTICES = readFileSync('THIRD-PARTY-NOTICES.md', 'utf8');
const entries = parseNotices(NOTICES).filter((entry) => entry.section !== SUMMARY_SECTION);
const software = entries.find((entry) => entry.section === 'Components and license texts')!;

const noticeReads = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('THIRD-PARTY-NOTICES.md')).length;
const openLicenses = () => fireEvent.mouseDown(screen.getByRole('tab', { name: 'Licenses' }));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(NOTICES, { status: 200 })));
  render(
    <AgeGateProvider>
      <UserProfileContext.Provider value={{ openProfile: vi.fn(), setListingOpener: vi.fn() }}>
        <CreditsDialog open onOpenChange={vi.fn()} />
      </UserProfileContext.Provider>
    </AgeGateProvider>,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the Licenses tab', () => {
  it('reads nothing until the tab opens, and once however often it reopens', async () => {
    expect(noticeReads()).toBe(0);
    openLicenses();
    await screen.findByRole('searchbox', { name: 'Filter by Name' });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Credits' }));
    openLicenses();
    await screen.findByRole('searchbox', { name: 'Filter by Name' });
    expect(noticeReads()).toBe(1);
  });

  it('cancels the read when the dialog closes', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(() => {}));
    openLicenses();
    await waitFor(() => expect(noticeReads()).toBe(1));
    const { signal } = vi.mocked(fetch).mock.calls[0][1]!;
    expect(signal!.aborted).toBe(false);
    cleanup();
    expect(signal!.aborted).toBe(true);
  });

  it('lists Bundled Assets, then Standards, then Software, with Game Icons and CMUdict', async () => {
    openLicenses();
    const panel = await screen.findByRole('tabpanel');
    await within(panel).findByRole('heading', { name: 'Software' });
    expect(within(panel).getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Bundled Assets', 'Standards & Specifications', 'Software']);
    expect(within(panel).getByRole('button', { name: 'Game Icons' })).toBeInTheDocument();
    for (const name of ['CMUdict', 'Text to Speech pronunciation model', 'kokoro-js']) {
      expect(within(panel).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(panel).queryByRole('button', { name: 'eSpeak NG' })).toBeNull();
    expect(within(panel).queryByText('Software license summary')).toBeNull();
  });

  it('shows every entry of the real file: each one named and non-empty, none in a section the tab drops', async () => {
    expect(entries.every((entry) => entry.name !== '' && entry.text !== '')).toBe(true);
    openLicenses();
    const panel = await screen.findByRole('tabpanel');
    await within(panel).findByRole('heading', { name: 'Software' });
    expect(within(panel).getAllByRole('heading', { level: 2 })).toHaveLength(new Set(entries.map((entry) => entry.section)).size);
    expect(panel.querySelectorAll('button[aria-expanded]')).toHaveLength(entries.length);
  });

  it('mounts no license text until a row opens, then shows the whole text', async () => {
    openLicenses();
    const panel = await screen.findByRole('tabpanel');
    await within(panel).findByRole('button', { name: 'LLVM OpenMP' });
    expect(panel).not.toHaveTextContent('The LLVM Project is under');

    fireEvent.click(within(panel).getByRole('button', { name: 'LLVM OpenMP' }));
    const lines = entries.find((entry) => entry.name === 'LLVM OpenMP')!.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    await waitFor(() => expect(panel).toHaveTextContent('The LLVM Project is under'));
    // The license's last line proves the row holds the whole text, and the missing fence proves it renders.
    expect(panel).toHaveTextContent(lines[lines.length - 2]);
    expect(panel).not.toHaveTextContent('```');
  });

  it('filters by name, case-insensitively, and says so when nothing matches', async () => {
    openLicenses();
    const box = await screen.findByRole('searchbox', { name: 'Filter by Name' });
    const panel = screen.getByRole('tabpanel');

    fireEvent.change(box, { target: { value: software.name.toUpperCase() } });
    expect(within(panel).getByRole('button', { name: software.name })).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'LLVM OpenMP' })).toBeNull();

    fireEvent.change(box, { target: { value: 'no such package' } });
    expect(within(panel).getByText('No license has that name.')).toBeInTheDocument();
    expect(within(panel).queryAllByRole('button', { name: software.name })).toHaveLength(0);
  });
});

describe('the Licenses tab when the read fails', () => {
  it('shows a message and reads again on Try Again', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));
    openLicenses();

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the licenses.');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('button', { name: 'LLVM OpenMP' })).toBeInTheDocument();
    expect(noticeReads()).toBe(2);
  });
});
