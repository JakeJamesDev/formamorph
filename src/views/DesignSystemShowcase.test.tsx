import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DesignSystemShowcase } from './DesignSystemShowcase';
import { SETTINGS_COPY } from '@/components/modals/settingsCopy';

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

    const layout = screen.getByRole('radiogroup', { name: 'Narration Layout' });
    const chat = within(layout).getByRole('radio', { name: 'Chat' });
    await user.click(chat);
    expect(chat).toHaveAttribute('data-state', 'on');

    const scale = screen.getByRole('slider', { name: 'Narration Size' });
    scale.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('105%')).toBeInTheDocument();

    const displayReference = screen.getByRole('region', { name: 'Display Reference' });
    const appearance = within(displayReference).getByRole('heading', { name: 'Appearance' }).closest('section') as HTMLElement;
    await user.click(within(appearance).getByRole('button', { name: 'More info' }));
    // The popover carries the production description, read from the table so a copy edit can't strand this.
    expect(await screen.findByText(SETTINGS_COPY.theme.description)).toBeInTheDocument();
    expect(localStorage).toHaveLength(0);
  });

  it('labels a Default and a Selected example in the control states reference', () => {
    renderShowcase();

    const states = screen.getByRole('region', { name: 'Control States' });

    expect(within(states).getByRole('textbox', { name: 'Model Name' })).toHaveValue('Silver Siren 12B');

    const paragraphLimit = within(states).getByRole('radiogroup', { name: 'Paragraph Limit' });
    const selected = within(paragraphLimit).getAllByRole('radio', { checked: true });
    expect(selected).toHaveLength(1);
    expect(within(paragraphLimit).getByRole('radio', { name: /^Auto/ })).toHaveAttribute('data-state', 'on');
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

describe('main menu context menu reference', () => {
  it('registers the production tile menu in the showcase', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getByRole('tab', { name: 'Context Menu' }));

    expect(screen.getByRole('heading', { name: 'Grouped Context Actions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sample world/i })).toBeInTheDocument();
  });
});

describe('narration turn reference', () => {
  it('registers the production Turn Card, Scene Plate, and choice rows in the showcase', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getByRole('tab', { name: 'Narration Turn' }));

    const latest = screen.getByRole('region', { name: 'Latest Page' });
    expect(within(latest).getByRole('button', { name: 'Zoom image' })).toBeInTheDocument();
    expect(within(latest).getByRole('button', { name: 'Re-generate Narration' })).toBeInTheDocument();
    expect(within(latest).getByTestId('choice-rows')).toBeInTheDocument();
  });
});

describe('rich list references', () => {
  it('registers the production-backed World Editor and Save/Load lists', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getByRole('tab', { name: 'Rich Lists' }));

    expect(screen.getByRole('heading', { name: 'World Editor List' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Save and Load List' })).toBeInTheDocument();
  });
});
