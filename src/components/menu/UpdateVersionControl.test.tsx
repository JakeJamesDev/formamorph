import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Isolate the component from the settings provider and the network: a stable channel + an "available" check.
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ updateChannel: 'stable', setUpdateChannel: vi.fn() }),
}));
vi.mock('@/services/UpdateService', async () => {
  const actual = await vi.importActual<typeof import('@/services/UpdateService')>('@/services/UpdateService');
  return {
    ...actual,
    checkForUpdate: vi.fn(async () => ({
      success: true,
      result: { available: true, latestVersion: 'v9.9.9', changelog: '## New stuff' },
    })),
  };
});
// Avoid the streaming-markdown pipeline in jsdom; the release notes just need to be present as text.
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="changelog">{text}</div>,
}));

import { UpdateVersionControl } from './UpdateVersionControl';

describe('UpdateVersionControl', () => {
  afterEach(() => { delete (window as { formamorphDesktop?: unknown }).formamorphDesktop; });

  it('tags the version when an update is available and opens the dialog with a Download action', async () => {
    render(<UpdateVersionControl />);

    // The check resolves to "available" → the info-colored tag appears next to the version.
    await waitFor(() => expect(screen.getByText(/Update Available!/)).toBeInTheDocument());

    // Clicking the version opens the update dialog in its available state.
    fireEvent.click(screen.getByTitle('Check for updates'));
    expect(await screen.findByText(/Update available — v9\.9\.9/)).toBeInTheDocument();
    expect(screen.getByTestId('changelog')).toHaveTextContent('New stuff');
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();

    // The "Full changelog" link points at the wiki and opens externally.
    const link = screen.getByRole('link', { name: /Full changelog/ });
    expect(link).toHaveAttribute('href', 'https://github.com/JakeJamesDev/formamorph/wiki/Changelog');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('resumes at "Update & Restart" when the available version is already staged on disk', async () => {
    // Desktop bridge reports a pending download whose version matches the available release.
    (window as unknown as { formamorphDesktop: unknown }).formamorphDesktop = {
      update: {
        pending: async () => ({ version: '9.9.9' }),
        onProgress: () => () => {},
        onDownloaded: () => () => {},
      },
    };

    render(<UpdateVersionControl />);

    // No re-download: it jumps straight to the apply button instead of showing Download.
    expect(await screen.findByRole('button', { name: /Update.*Restart/ })).toBeInTheDocument();
  });
});
