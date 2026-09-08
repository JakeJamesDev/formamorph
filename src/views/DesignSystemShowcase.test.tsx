import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DesignSystemShowcase } from './DesignSystemShowcase';

const renderShowcase = () => render(
  <ThemeProvider storageKey="design-system-test-theme">
    <TooltipProvider>
      <DesignSystemShowcase />
    </TooltipProvider>
  </ThemeProvider>,
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
});

afterEach(() => vi.restoreAllMocks());

describe('settings design reference', () => {
  it('resolves a system-dark preview before the root theme effect runs', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList);

    renderShowcase();

    expect(screen.getByText('The lanterns wake along the harbor.').parentElement)
      .toHaveAttribute('data-reference-theme', 'dark');
  });

  it('exercises production controls without writing persistent settings', async () => {
    const user = userEvent.setup();
    renderShowcase();

    expect(screen.getByRole('heading', { name: 'Display Reference' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Output Reference' })).toBeInTheDocument();

    const music = screen.getByRole('checkbox', { name: 'Background Music' });
    expect(music).toBeChecked();
    await user.click(music);
    expect(music).not.toBeChecked();

    const palette = screen.getByRole('combobox', { name: 'Palette' });
    await user.click(palette);
    await user.click(await screen.findByRole('option', { name: 'Purple' }));
    expect(palette).toHaveTextContent('Purple');

    const thinking = screen.getByRole('radiogroup', { name: 'Thinking' });
    const planning = within(thinking).getByRole('radio', { name: /^Planning/ });
    await user.click(planning);
    expect(planning).toHaveAttribute('data-state', 'on');

    const scale = screen.getByRole('slider', { name: 'Narration Size' });
    scale.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('105%')).toBeInTheDocument();

    const displayReference = screen.getByRole('region', { name: 'Display Reference' });
    await user.click(within(displayReference).getByRole('button', { name: 'More info' }));
    expect(await screen.findByText(/sets the app’s light or dark color scheme/i)).toBeInTheDocument();
    expect(localStorage).toHaveLength(0);
  });
});

describe('markdown editing reference', () => {
  it('opens the production editor with realistic local content and rendered preview', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getByRole('tab', { name: 'Markdown' }));

    expect(screen.getByRole('heading', { name: 'Markdown Editing Reference' })).toBeInTheDocument();
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Heading level')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'World Introduction' }))
      .toHaveTextContent('The Night Glass');

    await user.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(screen.getByRole('heading', { name: 'The Night Glass' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'old observatory' })).toBeInTheDocument();
    expect(screen.getByLabelText('Bold')).toBeDisabled();
    expect(localStorage).toHaveLength(0);
  });
});

describe('community card reference', () => {
  it('registers the production card reference in the showcase', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getByRole('tab', { name: 'Community Cards' }));

    expect(screen.getByRole('heading', { name: 'Community Creation Cards' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unlike — 286 likes/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('find bar reference', () => {
  it('registers the production Find bar in the showcase', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getByRole('tab', { name: 'Find' }));

    expect(screen.getByRole('heading', { name: 'Find Bar Reference' })).toBeInTheDocument();
    expect(screen.getByRole('search', { name: 'Find and replace in world' })).toBeInTheDocument();
  });
});

describe('code templates reference', () => {
  it('registers the production Code Templates dialog in the showcase', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getByRole('tab', { name: 'Code Templates' }));

    expect(screen.getByRole('heading', { name: 'Stat Code Templates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Code Templates' })).toBeInTheDocument();
  });
});
