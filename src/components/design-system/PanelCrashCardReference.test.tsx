import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PanelCrashCardReference } from './PanelCrashCardReference';

const panel = (name: 'Light' | 'Dark') => screen.getByRole('region', { name: `${name} Theme` });

describe('panel crash card reference', () => {
  it('shows the card at both widths in both themes, beside a list that stays', () => {
    render(<PanelCrashCardReference />);

    for (const name of ['Light', 'Dark'] as const) {
      expect(within(panel(name)).getAllByRole('heading', { name: 'This Panel Stopped Working' })).toHaveLength(2);
      expect(within(panel(name)).getByRole('list', { name: 'Sample entity list' })).toBeInTheDocument();
    }
  });

  it('reports what each button does in its own theme only', async () => {
    const user = userEvent.setup();
    render(<PanelCrashCardReference />);

    await user.click(within(panel('Dark')).getAllByRole('button', { name: 'Try Again' })[0]);

    expect(within(panel('Dark')).getByRole('status')).toHaveTextContent('Try Again remounts the panel.');
    expect(within(panel('Light')).getByRole('status')).toBeEmptyDOMElement();
  });
});
