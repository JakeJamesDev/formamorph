import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PanelTabStripReference } from './PanelTabStripReference';
import { ENTITY_PANEL_TABS } from '@/views/entityPanelTabs';
import { LOCATION_PANEL_TABS } from '@/views/locationPanelTabs';
import { TRAIT_PANEL_TABS } from '@/views/traitPanelTabs';
import { DICTIONARY_PANEL_TABS } from '@/views/dictionaryPanelTabs';
import type { PanelTab } from '@/components/ui/panel-tabs';

/** Every registry the reference renders, by the name of the strip that shows it. */
const REGISTRIES: [string, readonly PanelTab[]][] = [
  ['Sample Entity Fields', ENTITY_PANEL_TABS],
  ['Sample Location Fields', LOCATION_PANEL_TABS],
  ['Sample Trait Fields', TRAIT_PANEL_TABS],
  ['Sample Entry Fields', DICTIONARY_PANEL_TABS],
];

const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The innermost named region around a strip: its own section, not the reference card. */
function sectionOf(strip: HTMLElement) {
  const around = screen.getAllByRole('region').filter((region) => region.contains(strip));
  const section = around.find((region) => !around.some((inner) => inner !== region && region.contains(inner)));
  if (!section) throw new Error('strip has no region');
  return section;
}

describe('panel tab strip reference', () => {
  it('renders all four production registries and switches the body with the tab', async () => {
    const user = userEvent.setup();
    render(<PanelTabStripReference />);

    // Read from the registries, so a tab added to any panel cannot leave the reference behind.
    const entity = screen.getByRole('tablist', { name: 'Sample Entity Fields' });
    const location = screen.getByRole('tablist', { name: 'Sample Location Fields' });
    const trait = screen.getByRole('tablist', { name: 'Sample Trait Fields' });
    const entry = screen.getByRole('tablist', { name: 'Sample Entry Fields' });
    for (const { label } of ENTITY_PANEL_TABS) {
      expect(within(entity).getByRole('tab', { name: label })).toBeInTheDocument();
    }
    for (const { label } of LOCATION_PANEL_TABS) {
      expect(within(location).getByRole('tab', { name: label })).toBeInTheDocument();
    }
    for (const { label } of TRAIT_PANEL_TABS) {
      expect(within(trait).getByRole('tab', { name: label })).toBeInTheDocument();
    }
    for (const { label } of DICTIONARY_PANEL_TABS) {
      expect(within(entry).getByRole('tab', { name: label })).toBeInTheDocument();
    }

    expect(screen.getByText('Identity, picture, and where the entity is found.')).toBeInTheDocument();
    await user.click(within(entity).getByRole('tab', { name: 'Descriptions' }));
    expect(screen.getByText('The prose the player reads and the prose the model reads.')).toBeInTheDocument();
  });

  it('gives each registry its own bodies, so a shared tab value does not share its text', async () => {
    const user = userEvent.setup();
    render(<PanelTabStripReference />);

    // Location and trait both open on `details`, and each one holds different fields.
    expect(screen.getByText('Name, starting location, and the three descriptions.')).toBeInTheDocument();
    expect(screen.getByText('Name and both descriptions.')).toBeInTheDocument();

    // And both carry a `pins` tab whose rows are not the same rows.
    const trait = screen.getByRole('tablist', { name: 'Sample Trait Fields' });
    await user.click(within(trait).getByRole('tab', { name: 'Pins' }));
    expect(screen.getByText('Placeholder pin rows.')).toBeInTheDocument();
    expect(screen.queryByText('Placeholder pin rows and their conflict notes.')).toBeNull();
  });

  it('opens a body with text on every tab of every strip', async () => {
    const user = userEvent.setup();
    render(<PanelTabStripReference />);

    for (const [stripLabel, tabs] of REGISTRIES) {
      const strip = screen.getByRole('tablist', { name: stripLabel });
      const section = sectionOf(strip);
      for (const { label } of tabs) {
        await user.click(within(strip).getByRole('tab', { name: label }));
        expect(within(section).getByRole('tabpanel').textContent?.trim(), `${stripLabel} › ${label}`).not.toBe('');
      }
    }
  });

  it('states each strip\'s real tab count in its heading', () => {
    render(<PanelTabStripReference />);

    for (const [stripLabel, tabs] of REGISTRIES) {
      const section = sectionOf(screen.getByRole('tablist', { name: stripLabel }));
      const heading = within(section).getByRole('heading').textContent ?? '';
      const stated = COUNT_WORDS.findIndex((word) => new RegExp(`\\b${word}\\b`, 'i').test(heading));
      // A heading may name another property instead of a count; one that states a count must be right.
      if (stated !== -1) expect(stated, heading).toBe(tabs.length);
    }
  });

  it('runs the strips from most tabs to fewest', () => {
    render(<PanelTabStripReference />);

    const counts = screen.getAllByRole('tablist').map((strip) => within(strip).getAllByRole('tab').length);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('names every tab even where the label is not drawn', () => {
    render(<PanelTabStripReference />);

    // The label span is display:none below `xl`, so the accessible name has to come from `aria-label`.
    // A trigger that leaned on its text content would go nameless on a phone.
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-label');
      expect(tab.getAttribute('aria-label')).not.toBe('');
    }
  });
});
