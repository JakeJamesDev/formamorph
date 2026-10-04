import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DesignSystemShowcase } from './DesignSystemShowcase';
import { SETTINGS_COPY } from '@/components/modals/settingsCopy';
import { loadEmbeddingModel, disposeEmbeddingModel } from '@/lib/embeddingWorkerClient';

vi.mock('@/lib/embeddingWorkerClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/embeddingWorkerClient')>()),
  loadEmbeddingModel: vi.fn(() => Promise.resolve()),
  disposeEmbeddingModel: vi.fn(() => Promise.resolve()),
}));

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

  it('renders the production Display and Output sections in order', () => {
    renderShowcase();

    const headings = (name: string) => within(screen.getByRole('region', { name }))
      .getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent).filter((text) => text !== name);
    expect(headings('Display Reference')).toEqual(['Appearance', 'Scene', 'Narration', 'Accessibility', 'Inspection']);
    expect(headings('Output Reference')).toEqual(
      ['Turn Extras', 'Reasoning', 'Tools', 'Memory', 'Time', 'Lore', 'Characters', 'Choices', 'Attachments', 'Performance'],
    );
  });

  it('switches between the Simple and Advanced row sets', async () => {
    const user = userEvent.setup();
    renderShowcase();

    const modeSwitch = screen.getByRole('radiogroup', { name: 'Settings mode' });
    await user.click(screen.getByRole('checkbox', { name: SETTINGS_COPY.markdownFormatting.label }));
    await user.click(within(modeSwitch).getByRole('radio', { name: 'Simple' }));
    expect(screen.queryByRole('checkbox', { name: SETTINGS_COPY.markdownFormatting.label })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Memory' })).toBeNull();
    expect(screen.getByLabelText('Hidden settings are off their defaults')).toBeInTheDocument();

    await user.click(within(modeSwitch).getByRole('radio', { name: /^Advanced/ }));
    expect(screen.getByRole('checkbox', { name: SETTINGS_COPY.markdownFormatting.label })).not.toBeChecked();
    expect(screen.getByRole('heading', { name: 'Memory' })).toBeInTheDocument();
  });

  it('changes production controls without writing settings or the theme', async () => {
    const user = userEvent.setup();
    renderShowcase();
    const root = document.documentElement;
    const rootClasses = root.className;
    const rootPalette = root.getAttribute('data-theme');

    const music = screen.getByRole('checkbox', { name: SETTINGS_COPY.backgroundMusic.label });
    await user.click(music);
    expect(music).not.toBeChecked();

    const palette = screen.getByRole('combobox', { name: SETTINGS_COPY.themeColor.label });
    await user.click(palette);
    await user.click(await screen.findByRole('option', { name: 'Purple' }));
    expect(palette).toHaveTextContent('Purple');

    const output = screen.getByRole('region', { name: 'Output Reference' });
    const planning = within(output).getByRole('radio', { name: /^Planning/ });
    await user.click(planning);
    expect(planning).toHaveAttribute('data-state', 'on');

    const display = screen.getByRole('region', { name: 'Display Reference' });
    await user.click(within(display).getByRole('radio', { name: /^Dark/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Settings saves the Dark theme at this step.');

    const sample = screen.getByText('The lanterns wake along the harbor.').parentElement;
    expect(sample).toHaveAttribute('data-reference-theme', 'dark');
    expect(sample).toHaveAttribute('data-theme', 'purple');

    expect(localStorage).toHaveLength(0);
    expect(root.className).toBe(rootClasses);
    expect(root.getAttribute('data-theme')).toBe(rootPalette);
  });

  it('turns on semantic features without loading the embedding model', async () => {
    const user = userEvent.setup();
    renderShowcase();

    const status = screen.getByRole('status');
    for (const label of [SETTINGS_COPY.semanticLore.label, SETTINGS_COPY.semanticMemory.label]) {
      await user.click(screen.getByRole('checkbox', { name: label }));
      expect(status).toHaveTextContent('The reference skipped the download.');
      await user.click(screen.getByRole('checkbox', { name: label }));
      expect(status).toHaveTextContent('The reference skipped the unload.');
    }

    expect(loadEmbeddingModel).not.toHaveBeenCalled();
    expect(disposeEmbeddingModel).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
  });

  it('opens the nested Display dialogs against local settings', async () => {
    const user = userEvent.setup();
    renderShowcase();

    await user.click(screen.getAllByRole('button', { name: /customize/i })[0]);
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: /choose reveal animation/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /preview theme/i }));
    expect(await screen.findByText(/Seeded from your current theme/)).toBeInTheDocument();
    expect(localStorage).toHaveLength(0);
  });

  it('keeps the Live Sample in its own block', () => {
    renderShowcase();

    const sample = screen.getByRole('region', { name: 'Live Sample' });
    expect(within(sample).getByText('The lanterns wake along the harbor.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Display Reference' }))
      .queryByText('The lanterns wake along the harbor.')).toBeNull();
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
    expect(screen.getByRole('button', { name: /sample entity/i })).toBeInTheDocument();
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

describe('breadcrumb picker reference', () => {
  it('shows the collapsed breadcrumb, the shared pick, and the empty and no-match lines', async () => {
    const user = userEvent.setup();
    renderShowcase();
    await user.click(screen.getByRole('tab', { name: 'Breadcrumb Picker' }));

    await user.click(screen.getByRole('combobox', { name: 'Default' }));
    expect(await screen.findByText('Lineage › … › Storms')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Search…'), 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('combobox', { name: 'Picked' }));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(4);
    expect(listbox.querySelectorAll('[data-state="checked"]')).toHaveLength(2);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('combobox', { name: 'Empty' }));
    expect(await screen.findByText('Nothing to pick')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('combobox', { name: 'Disabled Row' }));
    const disabledRow = await screen.findByRole('option', { name: /Fatigue/ });
    expect(disabledRow).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');

    expect(screen.getByRole('combobox', { name: 'Unavailable' })).toBeDisabled();
  });
});

describe('filter row reference', () => {
  it('shows the staff and user rows with the Filters button at its default', async () => {
    const user = userEvent.setup();
    renderShowcase();
    await user.click(screen.getByRole('tab', { name: 'Filter Row' }));

    const staff = screen.getByRole('region', { name: 'Staff Queue' });
    expect(within(staff).getByLabelText('Filter by status')).toBeInTheDocument();
    expect(within(staff).getByLabelText('Sort by')).toBeInTheDocument();
    expect(within(staff).getByRole('button', { name: 'More Filters' })).toBeInTheDocument();

    const userTab = screen.getByRole('region', { name: 'User Tab' });
    expect(within(userTab).getByLabelText('Which threads')).toBeInTheDocument();
    expect(within(userTab).getByRole('button', { name: 'Report a Bug' })).toBeInTheDocument();
    await user.click(within(userTab).getByRole('button', { name: 'More Filters' }));
    expect(within(userTab).getByRole('button', { name: 'Reset Filters' })).toBeDisabled();
  });
});

describe('preset header reference', () => {
  it('registers the production header, badge and Reset and Compare pair in the showcase', async () => {
    const user = userEvent.setup();
    renderShowcase();
    await user.click(screen.getByRole('tab', { name: 'Preset Header' }));

    expect(screen.getByRole('region', { name: 'Preset Header Reference' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Editable, Wide' })).getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Editable, Narrow' })).getByRole('button', { name: 'Preset Actions' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Missing Model' })).getByText(/^Reachable, but no/)).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Single Prompt' })).getByRole('button', { name: 'Compare Narration Prompt' })).toBeInTheDocument();
  });
});

describe('supporter flair reference', () => {
  it('shows badges, names, and ringed Profile Images in both themes beside the staff badges', async () => {
    const user = userEvent.setup();
    renderShowcase();
    await user.click(screen.getByRole('tab', { name: 'Supporter Flair' }));

    for (const theme of ['Light Theme', 'Dark Theme']) {
      const panel = screen.getByRole('region', { name: theme });
      expect(within(panel).getAllByText('Supporter').length).toBeGreaterThan(0);
      expect(within(panel).getAllByText('Supporter+').length).toBeGreaterThan(0);
      for (const staff of ['Mod', 'Dev', 'Admin']) expect(within(panel).getAllByText(staff).length).toBeGreaterThan(0);
      expect(panel.querySelectorAll('[class*="ring-supporter"]').length).toBeGreaterThan(0);
    }
  });
});
