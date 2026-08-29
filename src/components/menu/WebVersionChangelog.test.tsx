import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    fireEvent.click(screen.getByRole('button', { name: /What.s new/ }));

    expect(await screen.findByText("What’s new")).toBeInTheDocument();
    expect(await screen.findByTestId('changelog')).toHaveTextContent('Latest notes');

    const link = screen.getByRole('link', { name: /Full changelog/ });
    expect(link).toHaveAttribute('href', 'https://github.com/JakeJamesDev/formamorph/wiki/Changelog');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

describe('changelog panel typography', () => {
  // Streamdown sizes the rendered markdown off the raw Tailwind scale, so every element in the panel needs a
  // size of ours to land on a role. A literal font-size is how the panel drifted off the scale before: it
  // reads as deliberate, but it's invisible to the role system and nothing else in the toolchain lints CSS.
  it('sizes .changelog-body through the font roles, never a literal font-size', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');
    const offenders = [...css.matchAll(/(\.changelog-body[^{]*)\{([^}]*)\}/g)]
      .filter(([, , body]) => /(^|[;\s])font-size\s*:/.test(body))
      .map(([, selector]) => selector.trim());
    expect(offenders).toEqual([]);
  });

  it('pins the elements Streamdown sizes to a role', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');
    const roleFor = (selector: string) => {
      const m = new RegExp(`\\.changelog-body ${selector}\\s*\\{([^}]*)\\}`).exec(css);
      return /@apply\s+([\w-]*text-[\w-]+)/.exec(m?.[1] ?? '')?.[1];
    };
    // The version headings and inline code. `h2` is the one that rendered at 24px in a 14px panel.
    expect(roleFor('h2')).toBe('text-title');
    expect(roleFor('h3')).toBe('text-meta');
    expect(roleFor('code')).toBe('text-label');
  });
});
