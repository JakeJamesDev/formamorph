import { useState } from 'react';
import { createPortal } from 'react-dom';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChipInput from './ChipInput';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { ensureShieldedLayer } from '@/components/ui/shielded-layer';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

const WORLD: Placeholder[] = [{ id: 'hair', name: 'Hair', values: phValues(['brown']) }];

function PageField() {
  const [value, setValue] = useState('.');
  return (
    <ChipInput value={value} onChange={setValue} vocabulary={usePlaceholderChipVocabulary(WORLD)} ariaLabel="Page field" />
  );
}

/** The help window: content portaled into the shielded layer, as the real one is. */
function HelpWindow() {
  const [layer] = useState(() => ensureShieldedLayer());
  return createPortal(<div><button>Help button</button><input aria-label="Help field" /></div>, layer);
}

const menu = () => screen.queryByTestId('chip-typeahead');

async function renderOpen() {
  render(<><PageField /><HelpWindow /></>);
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Page field'));
  await user.keyboard('{{');
  await screen.findByTestId('chip-typeahead');
  return user;
}

describe('a chip typeahead below the help window', () => {
  it('stays open on a press in the help window', async () => {
    const user = await renderOpen();
    await user.click(screen.getByRole('button', { name: 'Help button' }));
    expect(menu()).toBeInTheDocument();
  });

  it('stays open on Escape in the help window', async () => {
    const user = await renderOpen();
    await user.click(screen.getByRole('textbox', { name: 'Help field' }));
    await user.keyboard('{Escape}');
    expect(menu()).toBeInTheDocument();
  });

  it('still closes on Escape in its own field', async () => {
    const user = await renderOpen();
    await user.keyboard('{Escape}');
    expect(menu()).not.toBeInTheDocument();
  });
});
