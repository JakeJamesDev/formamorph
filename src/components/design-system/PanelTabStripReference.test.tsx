import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PanelTabStripReference } from './PanelTabStripReference';
import { ENTITY_PANEL_TABS } from '@/views/entityPanelTabs';
import { LOCATION_PANEL_TABS } from '@/views/locationPanelTabs';
import { TRAIT_PANEL_TABS } from '@/views/traitPanelTabs';

describe('panel tab strip reference', () => {
  it('renders all three production registries and switches the body with the tab', async () => {
    const user = userEvent.setup();
    render(<PanelTabStripReference />);

    // Read from the registries, so a tab added to any panel cannot leave the reference behind.
    const entity = screen.getByRole('tablist', { name: 'Sample Entity Fields' });
    const location = screen.getByRole('tablist', { name: 'Sample Location Fields' });
    const trait = screen.getByRole('tablist', { name: 'Sample Trait Fields' });
    for (const { label } of ENTITY_PANEL_TABS) {
      expect(within(entity).getByRole('tab', { name: label })).toBeInTheDocument();
    }
    for (const { label } of LOCATION_PANEL_TABS) {
      expect(within(location).getByRole('tab', { name: label })).toBeInTheDocument();
    }
    for (const { label } of TRAIT_PANEL_TABS) {
      expect(within(trait).getByRole('tab', { name: label })).toBeInTheDocument();
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
    expect(screen.getByText('Name, both descriptions, and the trait\'s two switches.')).toBeInTheDocument();

    // And both carry a `pins` tab whose rows are not the same rows.
    const trait = screen.getByRole('tablist', { name: 'Sample Trait Fields' });
    await user.click(within(trait).getByRole('tab', { name: 'Pins' }));
    expect(screen.getByText('Placeholder pin rows.')).toBeInTheDocument();
    expect(screen.queryByText('Placeholder pin rows and their conflict notes.')).toBeNull();
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
