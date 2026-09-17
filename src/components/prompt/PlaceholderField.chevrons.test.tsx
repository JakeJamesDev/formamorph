import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaceholderField from './PlaceholderField';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
import type { Placeholder } from '@/types';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

const world = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'world', placementId });
const unique = (id: string, placementId: string) => encodePlaceholderToken({ id, mode: 'unique', placementId });

const town: Placeholder = { id: 'town', name: 'Town', values: phValues(['Sedge Landing', 'Marrow', 'Harrow Point']) };
const hair: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['silver']) };
const gear: Placeholder = { id: 'gear', name: 'Gear', values: phValues(['rope', 'lamp', 'knife']), roll: false };
// A choice whose first value is the Town chip, so a chip can drill through it to Town.
const region: Placeholder = { id: 'region', name: 'Region', values: phValues([world('town', 'r1'), 'the wilds']) };
// Its first value pins Town to Marrow and Gear to lamp.
const lord: Placeholder = {
  id: 'lord',
  name: 'Lord',
  values: [
    { id: 'v:Ash', text: 'Ash', pins: [
      { placeholderId: 'town', value: 'Marrow', valueId: 'v:Marrow' },
      { placeholderId: 'gear', value: 'lamp', valueId: 'v:lamp' },
    ] },
    { id: 'v:Bram', text: 'Bram' },
  ],
};
const WORLD = [town, hair, gear, region, lord];
const drill = (mode: 'world' | 'unique', placementId: string) =>
  encodePlaceholderToken({ id: 'region', mode, placementId, path: [{ kind: 'val', ref: 'town' }] });

const openValues = (root: HTMLElement = document.body) =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-open-value]'));
const valueText = (el: HTMLElement) => el.querySelector('[data-open-value-text]')?.textContent ?? '';
const step = (el: HTMLElement, dir: 'Previous' | 'Next') =>
  userEvent.click(within(el).getByRole('button', { name: `${dir} Value` }));

/** Two fields under one editor: the first on Values, the second left for the caller to read. */
function Fields({ first, second = '' }: { first: string; second?: string }) {
  return (
    <EditorPreviewRollsProvider>
      <div data-testid="first"><PlaceholderField value={first} onChange={() => {}} placeholders={WORLD} /></div>
      <div data-testid="second"><PlaceholderField value={second} onChange={() => {}} placeholders={WORLD} /></div>
    </EditorPreviewRollsProvider>
  );
}

const first = () => screen.getByTestId('first');
const second = () => screen.getByTestId('second');
const openTab = (root: HTMLElement, name: string) => userEvent.click(within(root).getByRole('tab', { name }));

// Every draw lands on the first value until a test says otherwise.
const random = vi.spyOn(Math, 'random');
beforeEach(() => {
  localStorage.clear();
  random.mockReturnValue(0);
});
afterEach(() => random.mockReset());

describe('the Values tab chevrons', () => {
  it('step the open value and the shared roll, so Preview and other fields follow', async () => {
    render(<Fields first={`Welcome to ${world('town', 'p1')}.`} second={`Leaving ${world('town', 'p2')}.`} />);
    await openTab(first(), 'Values');
    const [open] = openValues(first());
    expect(valueText(open)).toBe('Sedge Landing');

    await step(open, 'Next');
    expect(valueText(openValues(first())[0])).toBe('Marrow');
    expect(within(first()).getByText(/Value 2 · 2\/3/)).toBeInTheDocument();

    await openTab(second(), 'Preview');
    expect(within(second()).getByTestId('prompt-preview')).toHaveTextContent('Leaving Marrow.');
    await openTab(first(), 'Preview');
    expect(within(first()).getByTestId('prompt-preview')).toHaveTextContent('Welcome to Marrow.');
  });

  it('wrap at both ends', async () => {
    render(<Fields first={`Welcome to ${world('town', 'p1')}.`} />);
    await openTab(first(), 'Values');
    await step(openValues(first())[0], 'Previous');
    expect(valueText(openValues(first())[0])).toBe('Harrow Point');
    await step(openValues(first())[0], 'Next');
    expect(valueText(openValues(first())[0])).toBe('Sedge Landing');
  });

  it('are absent on a Variable', async () => {
    render(<Fields first={`She has ${world('hair', 'p1')} hair.`} />);
    await openTab(first(), 'Values');
    const [open] = openValues(first());
    expect(valueText(open)).toBe('silver');
    expect(within(open).queryByRole('button')).toBeNull();
  });

  it('walk every value of an Object, which opens on its first, while Preview joins them all', async () => {
    render(<Fields first={`Pack: ${world('gear', 'p1')}.`} />);
    await openTab(first(), 'Values');
    const seen = [valueText(openValues(first())[0])];
    for (let i = 0; i < 3; i++) {
      await step(openValues(first())[0], 'Next');
      seen.push(valueText(openValues(first())[0]));
    }
    expect(seen).toEqual(['rope', 'lamp', 'knife', 'rope']);
    await openTab(first(), 'Preview');
    expect(within(first()).getByTestId('prompt-preview')).toHaveTextContent('Pack: rope, lamp, knife.');
  });

  it('move a Unique placement alone', async () => {
    render(<Fields first={`${unique('town', 'u1')} or ${unique('town', 'u2')}`} second={`At ${world('town', 'w1')}`} />);
    await openTab(first(), 'Values');
    await step(openValues(first())[0], 'Next');
    expect(openValues(first()).map(valueText)).toEqual(['Marrow', 'Sedge Landing']);
    await openTab(second(), 'Values');
    expect(openValues(second()).map(valueText)).toEqual(['Sedge Landing']);
  });

  it('step a World drill target under its own roll, and are absent on a Unique drill', async () => {
    render(<Fields first={`${drill('world', 'd1')} and ${drill('unique', 'd2')}`} second={`At ${world('town', 'w1')}`} />);
    await openTab(first(), 'Values');
    const [worldDrill, uniqueDrill] = openValues(first());
    expect(valueText(worldDrill)).toBe('Sedge Landing');
    expect(within(uniqueDrill).queryByRole('button')).toBeNull();
    await step(worldDrill, 'Next');
    expect(valueText(openValues(first())[0])).toBe('Marrow');
    await openTab(second(), 'Preview');
    expect(within(second()).getByTestId('prompt-preview')).toHaveTextContent('At Marrow');
  });

  it('are absent on a pinned chip, which opens on the pinned value', async () => {
    render(<Fields first={`${world('lord', 'l1')} of ${world('town', 'p1')} with ${world('gear', 'g1')}`} />);
    await openTab(first(), 'Values');
    const [, pinnedTown, pinnedGear] = openValues(first());
    expect(valueText(pinnedTown)).toBe('Marrow');
    expect(within(pinnedTown).getByText(/Value 2 · Pinned/)).toBeInTheDocument();
    expect(within(pinnedTown).queryByRole('button')).toBeNull();
    expect(valueText(pinnedGear)).toBe('lamp');
    expect(within(pinnedGear).queryByRole('button')).toBeNull();
    await openTab(first(), 'Preview');
    expect(within(first()).getByTestId('prompt-preview')).toHaveTextContent('Ash of Marrow with lamp');
  });
});

describe('Reroll on the Values tab', () => {
  it('redraws the open values', async () => {
    render(<Fields first={`Welcome to ${world('town', 'p1')}.`} />);
    await openTab(first(), 'Values');
    expect(valueText(openValues(first())[0])).toBe('Sedge Landing');
    random.mockReturnValue(0.99);
    await userEvent.click(within(first()).getByRole('button', { name: 'Reroll placeholders' }));
    expect(valueText(openValues(first())[0])).toBe('Harrow Point');
  });
});
