import { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APP_VERSION } from '@/lib/version';

const bundled = vi.hoisted(() => ({ text: null as string | null }));
const setUpdateChannel = vi.hoisted(() => vi.fn());

vi.mock('virtual:whats-new-summary', () => ({ get default() { return bundled.text; } }));
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ updateChannel: 'stable', setUpdateChannel }),
}));
// Recent Changes renders through the streaming-markdown pipeline; its text is all these tests read.
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="changelog">{text}</div>,
}));

import { resetReleaseFetch } from '@/services/UpdateService';
import { WhatsNewHost } from './WhatsNewHost';
import { WhatsNewVersionButton } from './WhatsNewVersionButton';

const INSTALLED = `v${APP_VERSION}`;

/** A Release Summary for the installed version whose lead names its source. */
function summaryMd(lead: string, firstEmoji = '⏳', title = INSTALLED) {
  return [
    `# Formamorph ${title}`, '', lead, '', 'Second paragraph.', '',
    '## Major', '',
    `- ${firstEmoji} **Since Last Turn** — a tray lists what you did.`,
    '- 🗓️ **Daily routines** — entities keep a schedule.',
    '  - **Map strangers** — the Map shows entities you have not met.', '',
    '## New', '',
    '- **Avatar looks** — stats change Avatar sliders.',
    '- **Openings tab** — openings get their own tab.', '',
    '## Fixes', '',
    'Fixed things, and more.', '',
    '---', '',
    '[Full changelog](https://example.invalid)',
  ].join('\n');
}

interface Release { tag_name: string; name: string; body: string; prerelease: boolean; draft: boolean; assets: never[]; published_at: string }
const release = (tag: string, body: string): Release =>
  ({ tag_name: tag, name: tag, body, prerelease: false, draft: false, assets: [], published_at: '' });

type FetchReply = Release[] | 'offline' | 'hang';
let fetchMock: ReturnType<typeof vi.fn>;
function serveReleases(reply: FetchReply) {
  fetchMock = vi.fn(() => {
    if (reply === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
    if (reply === 'hang') return new Promise(() => {});
    return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(reply) });
  });
  vi.stubGlobal('fetch', fetchMock);
}

function Harness({ timeoutMs }: { timeoutMs?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <WhatsNewHost open={open} onOpenChange={setOpen} summaryTimeoutMs={timeoutMs}>
      <WhatsNewVersionButton />
    </WhatsNewHost>
  );
}

const versionButton = () => screen.getByRole('button', { name: 'What’s New' });
async function openWhatsNew(timeoutMs?: number) {
  render(<Harness timeoutMs={timeoutMs} />);
  fireEvent.click(versionButton());
  return screen.findByRole('dialog');
}

beforeEach(() => {
  resetReleaseFetch();
  localStorage.clear();
  bundled.text = summaryMd('From the bundle.');
  setUpdateChannel.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { formamorphDesktop?: unknown }).formamorphDesktop;
  delete (window as { Capacitor?: unknown }).Capacitor;
});

describe('What’s New source order', () => {
  it('shows the GitHub release body when it parses', async () => {
    serveReleases([release(INSTALLED, summaryMd('From GitHub.'))]);
    await openWhatsNew();
    expect(await screen.findByText('From GitHub.')).toBeInTheDocument();
    expect(screen.queryByText('From the bundle.')).not.toBeInTheDocument();
  });

  it('shows the bundled summary when offline with no cached release', async () => {
    serveReleases('offline');
    await openWhatsNew();
    expect(await screen.findByText('From the bundle.')).toBeInTheDocument();
  });

  it('shows the cached release body before the bundled one when offline', async () => {
    localStorage.setItem('FORMAMORPH_updateCache', JSON.stringify({ fetchedAt: 0, releases: [release(INSTALLED, summaryMd('From the cache.'))] }));
    serveReleases('offline');
    await openWhatsNew();
    expect(await screen.findByText('From the cache.')).toBeInTheDocument();
    expect(screen.queryByText('From the bundle.')).not.toBeInTheDocument();
  });

  it('waits on a slow fetch, then shows the bundled summary when it times out', async () => {
    serveReleases('hang');
    const dialog = await openWhatsNew(30);
    expect(within(dialog).getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByText('From the bundle.')).toBeInTheDocument();
  });

  it('shows the bundled summary when the GitHub body does not parse', async () => {
    serveReleases([release(INSTALLED, '### Added\n\n- **Since Last Turn.** A tray lists what you did.')]);
    await openWhatsNew();
    expect(await screen.findByText('From the bundle.')).toBeInTheDocument();
  });

  it('shows the bundled summary when a titled GitHub body has an error', async () => {
    serveReleases([release(INSTALLED, summaryMd('From GitHub.').replace('## New', '## Highlights'))]);
    await openWhatsNew();
    expect(await screen.findByText('From the bundle.')).toBeInTheDocument();
  });

  it('shows the bundled summary when the GitHub body names another version', async () => {
    serveReleases([release(INSTALLED, summaryMd('From GitHub.').replace(INSTALLED, 'v0.0.1'))]);
    await openWhatsNew();
    expect(await screen.findByText('From the bundle.')).toBeInTheDocument();
  });

  it('opens on Recent Changes when no source has a summary', async () => {
    bundled.text = null;
    serveReleases('offline');
    await openWhatsNew();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Recent Changes' })).toHaveAttribute('aria-selected', 'true'));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'What’s New' }));
    expect(await screen.findByText('This version has no summary.')).toBeInTheDocument();
  });
});

describe('What’s New tiles', () => {
  /** Each tile as `kind:title`, in reading order. */
  const tiles = (dialog: HTMLElement) => [...dialog.querySelectorAll<HTMLElement>('[data-tile]')]
    .map((t) => `${t.dataset.tile}:${t.querySelector('h3')?.textContent ?? ''}`);

  it('pairs each Major with its nested item or the next New item, and ends with Fixes', async () => {
    serveReleases([release(INSTALLED, summaryMd('From GitHub.'))]);
    const dialog = await openWhatsNew();
    await screen.findByText('From GitHub.');
    expect(tiles(dialog)).toEqual([
      'major:Since Last Turn', 'new:Avatar looks',
      'major:Daily routines', 'new:Map strangers',
      'new:Openings tab', 'fixes:',
    ]);
    expect(within(dialog).getByText('Fixed things, and more.')).toBeInTheDocument();
    // The lead sits above the tiles; the rest of the intro sits below them.
    const text = dialog.textContent ?? '';
    expect(text.indexOf('From GitHub.')).toBeLessThan(text.indexOf('Since Last Turn'));
    expect(text.indexOf('Fixed things')).toBeLessThan(text.indexOf('Second paragraph.'));
  });

  it('shows a Major with an unmapped emoji with the default icon, not the emoji', async () => {
    serveReleases([release(INSTALLED, summaryMd('From GitHub.', '🦄'))]);
    const dialog = await openWhatsNew();
    await screen.findByText('From GitHub.');
    const icons = [...dialog.querySelectorAll('[data-tile="major"] [data-icon]')].map((i) => i.getAttribute('data-icon'));
    expect(icons).toEqual(['default', 'CalendarClock']);
    expect(dialog.textContent).not.toContain('🦄');
  });
});

describe('What’s New on the web', () => {
  it('lists the fetched notes under Recent Changes, with Full changelog and Close', async () => {
    serveReleases([release('v99.0.0', '### Added\n\n- Latest notes'), release(INSTALLED, summaryMd('From GitHub.'))]);
    const dialog = await openWhatsNew();
    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Recent Changes' }));
    expect(await within(dialog).findByTestId('changelog')).toHaveTextContent('Latest notes');
    expect(within(dialog).getByRole('link', { name: /Full changelog/ }))
      .toHaveAttribute('href', 'https://github.com/JakeJamesDev/formamorph/wiki/Changelog');
    expect(within(dialog).getByText('Close', { selector: 'button' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox', { name: 'Release Channel' })).not.toBeInTheDocument();
    // One fetch serves the summary and the notes.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

interface DesktopStub {
  pending?: () => Promise<{ version: string } | null>;
  download?: () => Promise<unknown>;
}
function plantDesktop({ pending = async () => null, download = async () => {} }: DesktopStub = {}) {
  let progress: ((p: { received: number; total: number }) => void) | null = null;
  (window as unknown as { formamorphDesktop: unknown }).formamorphDesktop = {
    update: {
      pending,
      download: vi.fn(download),
      apply: vi.fn(async () => {}),
      onProgress: (cb: typeof progress) => { progress = cb; return () => {}; },
      onDownloaded: () => () => {},
    },
  };
  return { progress: (p: { received: number; total: number }) => progress?.(p) };
}

const UPDATE_LIST = [release('v9.9.9', '### Added\n\n- New stuff'), release(INSTALLED, summaryMd('From GitHub.'))];

describe('What’s New with an update bridge', () => {
  it('tags the version when an update is available and offers Download in the banner', async () => {
    plantDesktop();
    serveReleases(UPDATE_LIST);
    render(<Harness />);
    await waitFor(() => expect(screen.getByText(/· Update Available/)).toBeInTheDocument());
    fireEvent.click(versionButton());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: INSTALLED })).toBeInTheDocument();
    expect(within(dialog).getByText('v9.9.9 is ready to download.')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Download' })).toHaveLength(1);
    expect(within(dialog).getByText('Close', { selector: 'button' })).toBeInTheDocument();
    expect(await within(dialog).findByText('From GitHub.')).toBeInTheDocument();
    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Recent Changes' }));
    expect(await within(dialog).findByTestId('changelog')).toHaveTextContent('New stuff');
  });

  it('marks the version button as the app-version target of the main menu', () => {
    plantDesktop();
    serveReleases(UPDATE_LIST);
    render(<Harness />);
    expect(versionButton()).toHaveAttribute('data-surface-target', 'mainMenu#app-version');
  });

  it('offers Check for Updates when up to date, and says so after a check', async () => {
    plantDesktop();
    serveReleases([release(INSTALLED, summaryMd('From GitHub.'))]);
    render(<Harness />);
    fireEvent.click(versionButton());
    const dialog = await screen.findByRole('dialog');
    const check = await within(dialog).findByRole('button', { name: 'Check for Updates' });
    expect(within(dialog).queryByText('You’re up to date.')).not.toBeInTheDocument();
    fireEvent.click(check);
    expect(await within(dialog).findByText('You’re up to date.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('names the failed step when the check fails', async () => {
    plantDesktop();
    serveReleases('offline');
    render(<Harness />);
    fireEvent.click(versionButton());
    expect(await screen.findByText(/Couldn’t check for updates\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check for Updates' })).toBeInTheDocument();
  });

  it('switches the release channel through the setting', async () => {
    plantDesktop();
    serveReleases(UPDATE_LIST);
    render(<Harness />);
    fireEvent.click(versionButton());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('combobox', { name: 'Release Channel' })).toHaveTextContent('Stable');
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Release Channel' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Pre-release' }));
    expect(setUpdateChannel).toHaveBeenCalledWith('prerelease');
  });

  it('closes on Download, then offers Close only while the update downloads', async () => {
    const desktop = plantDesktop({ download: () => new Promise(() => {}) });
    serveReleases(UPDATE_LIST);
    render(<Harness />);
    fireEvent.click(versionButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    desktop.progress({ received: 5_000_000, total: 0 });
    // A chunked response has no length. "/ 0 KB (0%)" would read as a stalled download.
    expect(await screen.findByText('5 MB')).toBeInTheDocument();
    expect(screen.queryByText(/0 KB|%/)).not.toBeInTheDocument();
    fireEvent.click(versionButton());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Downloading v9.9.9…')).toBeInTheDocument();
    expect(within(dialog).getByText('Close', { selector: 'button' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Check for Updates' })).not.toBeInTheDocument();
  });

  it('says the file opened in the browser after a browser download, with Download still offered', async () => {
    plantDesktop({ download: async () => ({ openedInBrowser: true }) });
    serveReleases(UPDATE_LIST);
    render(<Harness />);
    fireEvent.click(versionButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(versionButton());
    expect(await screen.findByText(/opened in your browser/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it('resumes at Update & Restart when the available version is already staged on disk', async () => {
    plantDesktop({ pending: async () => ({ version: '9.9.9' }) });
    serveReleases(UPDATE_LIST);
    render(<Harness />);
    expect(await screen.findByRole('button', { name: 'Update & Restart' })).toBeInTheDocument();
    fireEvent.click(versionButton());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/v9\.9\.9 is downloaded\./)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Close', { selector: 'button' })).toBeInTheDocument();
  });

  describe('update preview', () => {
    const NEWEST = release('v9.9.9', summaryMd('Newest lead.', '⏳', 'v9.9.9'));
    const OLDER = release('v9.9.8', summaryMd('Older lead.', '⏳', 'v9.9.8'));
    const OWN = release(INSTALLED, summaryMd('Installed lead.'));

    async function openUpdateDialog() {
      plantDesktop();
      render(<Harness />);
      fireEvent.click(versionButton());
      return screen.findByRole('dialog');
    }

    it('previews the newest release when two newer ones are available, and returns to the installed one', async () => {
      serveReleases([NEWEST, OLDER, OWN]);
      const dialog = await openUpdateDialog();
      expect(await within(dialog).findByText('Installed lead.')).toBeInTheDocument();
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Preview v9.9.9' }));
      expect(within(dialog).getByText('Newest lead.')).toBeInTheDocument();
      expect(within(dialog).getByText('Previewing v9.9.9')).toBeInTheDocument();
      expect(within(dialog).queryByText('Older lead.')).not.toBeInTheDocument();
      expect(within(dialog).queryByText('Installed lead.')).not.toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: `Back to ${INSTALLED}` }));
      expect(await within(dialog).findByText('Installed lead.')).toBeInTheDocument();
      expect(within(dialog).queryByText('Newest lead.')).not.toBeInTheDocument();
    });

    it('offers no preview link when the newest body does not parse, and the dialog still works', async () => {
      serveReleases([release('v9.9.9', '### Added\n\n- New stuff'), OLDER, OWN]);
      const dialog = await openUpdateDialog();
      expect(await within(dialog).findByText('Installed lead.')).toBeInTheDocument();
      expect(within(dialog).getByText('v9.9.9 is ready to download.')).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: /^Preview/ })).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Download' })).toBeInTheDocument();
    });

    it('previews a body whose Major uses an emoji this build does not map', async () => {
      serveReleases([release('v9.9.9', summaryMd('Newest lead.', '🦄', 'v9.9.9')), OWN]);
      const dialog = await openUpdateDialog();
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Preview v9.9.9' }));
      expect(within(dialog).getByText('Newest lead.')).toBeInTheDocument();
    });

    it('leaves the preview when the player opens Recent Changes', async () => {
      serveReleases([NEWEST, OWN]);
      const dialog = await openUpdateDialog();
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Preview v9.9.9' }));
      fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Recent Changes' }));
      fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'What’s New' }));
      expect(await within(dialog).findByText('Installed lead.')).toBeInTheDocument();
      expect(within(dialog).queryByText('Newest lead.')).not.toBeInTheDocument();
    });

    it('reopens on the installed summary after the dialog closes mid-preview', async () => {
      serveReleases([NEWEST, OWN]);
      const dialog = await openUpdateDialog();
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Preview v9.9.9' }));
      fireEvent.click(within(dialog).getByText('Close', { selector: 'button' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      fireEvent.click(versionButton());
      const reopened = await screen.findByRole('dialog');
      expect(await within(reopened).findByText('Installed lead.')).toBeInTheDocument();
      expect(within(reopened).queryByText('Newest lead.')).not.toBeInTheDocument();
    });

    it('does not offer a preview on the web', async () => {
      serveReleases([NEWEST, OWN]);
      const dialog = await openWhatsNew();
      expect(await within(dialog).findByText('Installed lead.')).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: /^Preview/ })).not.toBeInTheDocument();
    });
  });

  it('offers Install rather than a restart on Android', async () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = {
      isPluginAvailable: (name: string) => name === 'FormamorphUpdate',
      Plugins: {
        FormamorphUpdate: {
          pending: async () => ({ version: '9.9.9' }),
          addListener: async () => ({ remove: async () => {} }),
        },
      },
    };
    serveReleases(UPDATE_LIST);
    render(<Harness />);
    expect(await screen.findByRole('button', { name: 'Install' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restart/ })).not.toBeInTheDocument();
  });
});
