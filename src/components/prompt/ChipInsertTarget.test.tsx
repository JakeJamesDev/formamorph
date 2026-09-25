import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChipInput from './ChipInput';
import { CHIP_PALETTE_ATTR, ChipInsertTargetProvider, useChipInsertTarget } from './ChipInsertTarget';
import { usePlaceholderChipVocabulary } from '@/lib/chipVocabulary';
import { decodePlaceholderToken, encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

const WORLD: Placeholder[] = [{ id: 'eye', name: 'Eye', values: phValues(['blue', 'green']) }];
const EYE = encodePlaceholderToken({ id: 'eye', mode: 'world', placementId: 'palette' });

/** A name field: it offers no Built-ins. */
const NameField = ({ onChange }: { onChange: (value: string) => void }) => (
  <ChipInput value="" onChange={onChange} vocabulary={usePlaceholderChipVocabulary(WORLD)} ariaLabel="Name" />
);

/** A palette that sends whatever it is given, with no filter of its own. */
const Sender = ({ token }: { token: string }) => {
  const { insert } = useChipInsertTarget();
  return <div {...{ [CHIP_PALETTE_ATTR]: '' }}><button type="button" onClick={() => insert?.(token)}>{token}</button></div>;
};

const mount = (onChange: (value: string) => void) => render(
  <ChipInsertTargetProvider>
    <NameField onChange={onChange} />
    <Sender token="{{user}}" />
    <Sender token={EYE} />
  </ChipInsertTargetProvider>,
);

describe('the claimed field', () => {
  it('takes a token it accepts', async () => {
    const onChange = vi.fn();
    mount(onChange);
    await userEvent.click(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.click(screen.getByRole('button', { name: EYE }));
    expect(decodePlaceholderToken(onChange.mock.lastCall?.[0] ?? '')?.id).toBe('eye');
  });

  it('refuses a Built-in it does not offer', async () => {
    const onChange = vi.fn();
    mount(onChange);
    await userEvent.click(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.click(screen.getByRole('button', { name: '{{user}}' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
