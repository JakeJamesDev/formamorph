import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ updateChannel: 'stable', setUpdateChannel: vi.fn() }),
}));
// The notes marker is the `updateVersion` prop; expose it as an attribute to read it.
vi.mock('@/components/ChangelogUi', () => ({
  ChangelogBody: ({ text, updateVersion }: { text?: string; updateVersion?: string }) => (
    <div data-testid="changelog" data-update-version={updateVersion ?? ''}>{text}</div>
  ),
  FullChangelogLink: () => null,
}));

import { UpdateDialog } from './UpdateDialog';
import type { UpdatePhase, UpdateState } from '@/lib/updates/updateState';

function renderDialog(phase: UpdatePhase, extra: Partial<UpdateState> = {}) {
  const state: UpdateState = {
    phase, currentVersion: 'v1.0.0', channel: 'stable', latestVersion: 'v9.9.9', changelog: 'New stuff', ...extra,
  };
  return render(<UpdateDialog open onOpenChange={() => {}} state={state} onCheck={() => {}} onDownload={() => {}} />);
}

describe('UpdateDialog while the update downloads', () => {
  it.each(['downloading', 'downloaded'] as const)('names the update, keeps the notes marker and offers Close only (%s)', (phase) => {
    renderDialog(phase);
    expect(screen.getByRole('heading', { name: /v9\.9\.9/ })).toBeInTheDocument();
    expect(screen.queryByText(/up to date/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('changelog')).toHaveAttribute('data-update-version', 'v9.9.9');
    // The dialog's corner X is also named Close; the footer button is the one with its own text.
    expect(screen.getByText('Close', { selector: 'button' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check for updates' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('keeps Cancel and Download when an update is available', () => {
    renderDialog('available');
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByTestId('changelog')).toHaveAttribute('data-update-version', 'v9.9.9');
  });

  it('says the file opened in the browser after a browser download, with Download still offered', () => {
    renderDialog('available', { openedInBrowser: true });
    expect(screen.getByText(/opened in your browser/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });

  it.each(['available', 'downloading', 'downloaded', 'up-to-date'] as const)('shows no browser line without a browser download (%s)', (phase) => {
    renderDialog(phase);
    expect(screen.queryByText(/opened in your browser/i)).not.toBeInTheDocument();
  });

  it('keeps Check for updates for the up-to-date phase, with no marker', () => {
    renderDialog('up-to-date');
    expect(screen.getByRole('button', { name: 'Check for updates' })).toBeInTheDocument();
    expect(screen.getByTestId('changelog')).toHaveAttribute('data-update-version', '');
  });
});
