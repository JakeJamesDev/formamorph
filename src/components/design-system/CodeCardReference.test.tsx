import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CodeCardReference } from './CodeCardReference';

const theme = (name: 'Light' | 'Dark') => screen.getByRole('region', { name: `${name} Theme` });
const sample = (name: 'Light' | 'Dark', label: string) => within(theme(name)).getByRole('region', { name: label });

describe('code hover card reference', () => {
  it('draws every kind of card in both themes, from the production card model', () => {
    render(<CodeCardReference />);

    for (const name of ['Light', 'Dark'] as const) {
      expect(sample(name, 'Global')).toHaveTextContent('(global) self');
      const stat = sample(name, 'Stat');
      expect(stat).toHaveTextContent('(global stat) stats.Fatigue: Stat');
      for (const label of ['Type', 'Range', 'Starts At', 'Regen', 'Shown To']) {
        expect(within(stat).getByText(label)).toBeInTheDocument();
      }
      const trait = sample(name, 'Trait');
      expect(trait).toHaveTextContent('(global trait) traits.Brave: Trait');
      for (const label of ['Mode', 'Requires', 'Changes']) {
        expect(within(trait).getByText(label)).toBeInTheDocument();
      }
      expect(within(trait).queryByText('Owners')).not.toBeInTheDocument();
      expect(sample(name, 'Read-Only')).toHaveTextContent('Read-Only');
      expect(sample(name, 'Declared Name')).toHaveTextContent('Declared on line 1');
    }
  });

  it('fades the weight-0 value and keeps the rest at full strength', () => {
    render(<CodeCardReference />);

    const values = within(sample('Light', 'Placeholder')).getAllByRole('listitem');
    expect(values.map((item) => item.textContent)).toEqual(['calm ×2', 'wary ×1', 'giddy ×0']);
    expect(values.filter((item) => item.hasAttribute('data-benched')).map((item) => item.textContent)).toEqual(['giddy ×0']);
  });

  it('lists the uses under the pinned card, and says so when there are none', () => {
    render(<CodeCardReference />);

    const pinned = within(theme('Dark')).getByRole('region', { name: 'Find All Uses' });
    expect(within(pinned).getByRole('region', { name: 'Uses' })).toHaveTextContent('3 Uses');
    expect(within(pinned).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Open', 'Find All Uses',
      'Courage · After · Line 3',
      'Tom › Health · Before · Line 1',
      'Dread · After · Line 7No Owners',
    ]);
    expect(within(within(theme('Dark')).getByRole('region', { name: 'No Uses' })).getByText('No uses in scripts')).toBeInTheDocument();
  });

  it('reports what each control does in its own theme only', async () => {
    const user = userEvent.setup();
    render(<CodeCardReference />);

    await user.click(within(sample('Dark', 'Declared Name')).getByRole('button', { name: 'Go to Line 1' }));
    await user.click(within(sample('Dark', 'Global')).getByRole('link', { name: 'Read in the Guide' }));

    expect(within(theme('Dark')).getByRole('status')).toHaveTextContent('Read in the Guide opens the Guide at this heading.');
    expect(within(theme('Light')).getByRole('status')).toBeEmptyDOMElement();
    const open = within(sample('Dark', 'Stat')).getByRole('button', { name: 'Open' });
    await user.click(open);
    expect(within(theme('Dark')).getByRole('status')).toHaveTextContent('Open selects the item in the World Editor.');
    // The status text re-renders the panel, and the control the author just used stays where it was.
    expect(open.isConnected).toBe(true);
    expect(open).toBe(within(sample('Dark', 'Stat')).getByRole('button', { name: 'Open' }));
  });
});
