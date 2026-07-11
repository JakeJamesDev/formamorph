import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// The web changelog fetches the latest release's notes lazily on open; stub that fetch.
vi.mock('@/services/UpdateService', async () => {
  const actual = await vi.importActual<typeof import('@/services/UpdateService')>('@/services/UpdateService');
  return {
    ...actual,
    checkForUpdate: vi.fn(async () => ({ success: true, result: { available: false, changelog: '## Latest notes' } })),
  };
});
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="changelog">{text}</div>,
}));

import { WebVersionChangelog } from './WebVersionChangelog';

describe('WebVersionChangelog', () => {
  it('opens a changelog popout on click with the fetched notes, a Full changelog link, and Close', async () => {
    render(<WebVersionChangelog />);
    fireEvent.click(screen.getByTitle(/What.s new/));

    expect(await screen.findByText("What’s new")).toBeInTheDocument();
    expect(await screen.findByTestId('changelog')).toHaveTextContent('Latest notes');

    const link = screen.getByRole('link', { name: /Full changelog/ });
    expect(link).toHaveAttribute('href', 'https://github.com/JakeJamesDev/formamorph/wiki/Changelog');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
