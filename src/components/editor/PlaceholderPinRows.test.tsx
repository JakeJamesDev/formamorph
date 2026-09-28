import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { phValues } from '@/test/placeholderValues';
import type { PinEditorWorld, PinSourceRef } from '@/lib/placeholderPins';
import type { Placeholder, PlaceholderPin } from '@/types';
import { PlaceholderPinRows } from './PlaceholderPinRows';

const garb: Placeholder = { id: 'garb', name: 'Class Garb', values: phValues(['Robe', 'Plate']) };
const boots: Placeholder = { id: 'boots', name: 'Boots', values: phValues(['Sandals']) };

/** One trait's pin rows whose edits land, so a test reads what the author sees next. */
function Harness({ start, world = null, source = { kind: 'trait', id: 'paladin' } }: {
  start: PlaceholderPin; world?: PinEditorWorld | null; source?: PinSourceRef;
}) {
  const [pins, setPins] = useState([start]);
  return (
    <>
      <PlaceholderPinRows
        pins={pins} onChange={setPins} source={source} world={world}
        placeholders={world?.placeholders ?? [garb, boots]}
      />
      <output data-testid="stored">{JSON.stringify(pins)}</output>
    </>
  );
}
const stored = () => JSON.parse(screen.getByTestId('stored').textContent!) as PlaceholderPin[];
const sectionRow = (name: string) => screen.getAllByTestId('placeholder-section-row').find((row) => row.textContent === name)!;

describe('PlaceholderPinRows — the pin target', () => {
  it('re-aims a pin at another placeholder by id, keeping the typed value and dropping the old value id', async () => {
    render(<Harness start={{ placeholderId: 'garb', value: 'Plate', valueId: garb.values[1].id }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Class Garb' }));
    await userEvent.click(sectionRow('Boots'));
    expect(stored()).toEqual([{ placeholderId: 'boots', value: 'Plate' }]);
    expect(screen.getByRole('button', { name: 'Boots' })).toBeInTheDocument();
  });

  it("picks a value off the target's list and stores its id", async () => {
    render(<Harness start={{ placeholderId: 'garb', value: '' }} />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Pinned Value' }));
    await userEvent.click(screen.getByRole('button', { name: 'Robe' }));
    expect(stored()).toEqual([{ placeholderId: 'garb', value: 'Robe', valueId: garb.values[0].id }]);
  });

  it('removes a pin', async () => {
    render(<Harness start={{ placeholderId: 'garb', value: 'Plate' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Pin' }));
    expect(stored()).toEqual([]);
  });
});

describe('PlaceholderPinRows — pins by blueprint', () => {
  const blueprint: Placeholder = { ...garb, groupId: 'bp' };
  const copy: Placeholder = {
    id: 'albus-garb', name: 'Class Garb', blueprintId: 'garb', values: [{ id: 'v-rust', text: 'Rust Cloak' }],
    valueOverrides: { [garb.values[1].id]: { text: { value: 'Gilded Plate', blueprint: 'Plate' } } },
  };
  const world: PinEditorWorld = {
    traits: [{ id: 'paladin', name: 'Paladin', statChanges: [] }],
    placeholders: [blueprint, boots, copy],
    placeholderGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  };
  const offered = async (name: string) => {
    await userEvent.click(screen.getByRole('button', { name }));
    return screen.getAllByTestId('placeholder-section-row').map((row) => row.textContent);
  };

  it("offers a world trait the blueprint with the blueprint's values, and no copy", async () => {
    render(<Harness world={world} start={{ placeholderId: 'boots', value: '' }} />);
    expect(await offered('Boots')).toEqual(['Boots', 'Class Garb']);
    await userEvent.click(sectionRow('Class Garb'));
    await userEvent.click(screen.getByRole('textbox', { name: 'Pinned Value' }));
    expect(screen.getByRole('button', { name: 'Plate' })).toBeInTheDocument();
  });

  it('keeps blueprints from a location', async () => {
    render(<Harness world={world} source={{ kind: 'location', id: 'fen' }} start={{ placeholderId: 'boots', value: '' }} />);
    expect(await offered('Boots')).toEqual(['Boots']);
  });

  it("keeps a stored pin's copy picked, valued by the copy's own reading", async () => {
    render(<Harness world={world} start={{ placeholderId: 'albus-garb', value: '' }} />);
    expect(screen.getByRole('button', { name: /Class Garb/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('textbox', { name: 'Pinned Value' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gilded Plate' }));
    expect(stored()).toEqual([{ placeholderId: 'albus-garb', value: 'Gilded Plate', valueId: garb.values[1].id }]);
  });
});
