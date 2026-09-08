import { useState, type ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EnterWorldWorkspace from './EnterWorldWorkspace';
import type { Trait } from '@/types';

const identity = (text: string) => text;
const traitIdentity = (_trait: Trait, text: string) => text;

const groups = [
  { id: 'origin', name: 'Origin', parentId: null, order: 0, playerDescription: 'Where you came from.' },
  { id: 'culture', name: 'Culture', parentId: 'origin', order: 0, playerDescription: 'What shaped you.', exclusive: true },
  { id: 'calling', name: 'Calling', parentId: 'culture', order: 0 },
  { id: 'discipline', name: 'Discipline', parentId: 'calling', order: 0 },
  { id: 'practice', name: 'Practice', parentId: 'discipline', order: 0 },
  { id: 'empty', name: 'Empty branch', parentId: null, order: 1 },
];

const traits: Trait[] = [
  { id: 'local', name: 'Local', groupId: 'culture', order: 0, isDefault: true, statChanges: [] },
  { id: 'outsider', name: 'Outsider', groupId: 'culture', order: 1, statChanges: [] },
  { id: 'artisan', name: 'Artisan', groupId: 'practice', order: 0, statChanges: [] },
];

function Harness(props: Partial<ComponentProps<typeof EnterWorldWorkspace>> = {}) {
  const [selectedTraits, setSelectedTraits] = useState(['local']);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  return (
    <EnterWorldWorkspace
      worldName="Entry World"
      traits={traits}
      traitGroups={groups}
      stats={[]}
      locations={[]}
      resolveText={identity}
      resolveTraitText={traitIdentity}
      selectedTraits={selectedTraits}
      selectedLocationId={selectedLocationId}
      categoryIndex={categoryIndex}
      onCategoryChange={setCategoryIndex}
      onTraitSelect={(id) => setSelectedTraits((current) => current.includes(id)
        ? current.filter((traitId) => traitId !== id)
        : [...current, id])}
      onLocationChange={setSelectedLocationId}
      onIntroduction={vi.fn()}
      onCancel={vi.fn()}
      onContinue={vi.fn()}
      continueLabel="Start game"
      {...props}
    />
  );
}

describe('EnterWorldWorkspace', () => {
  it('opens the first meaningful category in an always-expanded authored hierarchy', () => {
    render(<Harness />);

    const navigation = screen.getByRole('navigation', { name: 'World setup categories' });
    expect(within(navigation).getByText('Origin').closest('button')).toBeNull();
    expect(within(navigation).getByRole('button', { name: /Culture/ })).toHaveAttribute('aria-current', 'page');
    expect(within(navigation).getByLabelText('1 of 2 selected')).toHaveTextContent('1/2');
    expect(within(navigation).getByText('Calling').closest('button')).toBeNull();
    expect(within(navigation).getByText('Discipline').closest('button')).toBeNull();
    expect(within(navigation).getByRole('button', { name: /Practice/ })).toBeInTheDocument();
    expect(within(navigation).queryByText('Empty branch')).not.toBeInTheDocument();
    expect(within(navigation).queryByText('General')).not.toBeInTheDocument();
    expect(within(navigation).queryByText(/Selected|Folder/)).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Culture' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Culture choices' })).toBeInTheDocument();
    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('Outsider')).toBeInTheDocument();
    expect(screen.getAllByText('Where you came from.')).toHaveLength(2);

    fireEvent.click(within(navigation).getByRole('button', { name: /Practice/ }));
    expect(screen.getByRole('heading', { name: 'Practice' })).toBeInTheDocument();
    expect(screen.getByText('Artisan')).toBeInTheDocument();
  });

  it('activates exclusive radios and other checkboxes exactly once from the row or indicator', async () => {
    const user = userEvent.setup();
    const onTraitSelect = vi.fn();
    render(<Harness onTraitSelect={onTraitSelect} />);

    expect(fireEvent.click(screen.getByText('Local'))).toBe(true);
    expect(onTraitSelect).toHaveBeenLastCalledWith('local');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);

    onTraitSelect.mockClear();
    expect(fireEvent.click(screen.getByRole('radio', { name: 'Local' }))).toBe(true);
    expect(onTraitSelect).toHaveBeenLastCalledWith('local');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);

    onTraitSelect.mockClear();
    await user.click(screen.getByRole('radio', { name: 'Outsider' }));
    expect(onTraitSelect).toHaveBeenLastCalledWith('outsider');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Practice/ }));
    expect(screen.getByRole('checkbox', { name: 'Artisan' })).not.toBeChecked();
    onTraitSelect.mockClear();
    await user.click(screen.getByText('Artisan'));
    expect(onTraitSelect).toHaveBeenLastCalledWith('artisan');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);

    onTraitSelect.mockClear();
    await user.click(screen.getByRole('checkbox', { name: 'Artisan' }));
    expect(onTraitSelect).toHaveBeenLastCalledWith('artisan');
    expect(onTraitSelect).toHaveBeenCalledTimes(1);
  });

  it('uses Starting Location as the first category when a world has no traits', async () => {
    const user = userEvent.setup();
    const onLocationChange = vi.fn();
    render(
      <Harness
        traits={[]}
        traitGroups={[]}
        locations={[
          { id: 'harbor', name: 'Harbor', isStarting: true, playerDescription: 'A salty dock.' },
          { id: 'hill', name: 'Hill', isStarting: true },
        ]}
        onLocationChange={onLocationChange}
      />,
    );

    expect(screen.queryByText('General')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Starting Location' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Random' })).toBeChecked();
    expect(screen.getByText('A salty dock.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Hill' }));
    expect(onLocationChange).toHaveBeenCalledOnce();
    expect(onLocationChange).toHaveBeenCalledWith('hill');
  });

  it('shows resolved trait descriptions and visible stat-effect previews', () => {
    render(
      <Harness
        traits={[
          {
            id: 'local', name: 'Local', groupId: 'culture', order: 0, statChanges: [
              { statId: 'favor', value: 5, type: 'starting' },
              { statId: 'secret', value: -2, type: 'starting' },
            ],
            playerDescription: 'Known around TOKEN.',
          },
        ]}
        stats={[
          { id: 'favor', name: 'TOKEN Standing', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [] },
          { id: 'secret', name: 'Secret', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], hidden: true },
        ]}
        resolveTraitText={(_trait, text) => text.replace('TOKEN', 'Sedge')}
      />,
    );

    expect(screen.getByText('Known around Sedge.')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === 'LI' && element.textContent === 'Sedge Standing: +5',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Secret/)).not.toBeInTheDocument();
  });

  it('keeps workspace actions outside scrolling content and updates ratios immediately', async () => {
    const user = userEvent.setup();
    const onIntroduction = vi.fn();
    const onCancel = vi.fn();
    const onContinue = vi.fn();
    render(
      <Harness
        onIntroduction={onIntroduction}
        onCancel={onCancel}
        onContinue={onContinue}
        continueLabel="Continue to Dictionaries"
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Enter Entry World' });
    const content = within(dialog).getByRole('main');
    const continueButton = within(dialog).getByRole('button', { name: 'Continue to Dictionaries' });
    expect(content).not.toContainElement(continueButton);

    await user.click(screen.getByRole('radio', { name: 'Local' }));
    expect(screen.getByLabelText('0 of 2 selected')).toHaveTextContent('0/2');

    await user.click(within(dialog).getByRole('button', { name: 'Introduction' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(continueButton);
    expect(onIntroduction).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
