import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RequirementRowsField } from './RequirementRowsField';
import { conditionTexts, ruleStates, type GateInput } from '@/lib/traitGates';
import { NO_ACTIVE } from '@/lib/traitGates';
import type { TraitRequirementRow } from '@/types';

const input: GateInput = { global: { traits: [], groups: [] }, owners: [], active: NO_ACTIVE, entities: [], persona: { source: 'none' } };
const textOf = conditionTexts(input);

/** The field over the real rule text and the real row states, with edits that land. */
function Harness({ initial = [], offWorld = false }: { initial?: TraitRequirementRow[]; offWorld?: boolean }) {
  const [rows, setRows] = useState(initial);
  return (
    <TooltipProvider>
      <RequirementRowsField
        rows={rows} states={ruleStates(input, null, rows)} placeholders={[]} offWorld={offWorld}
        options={{ traits: [], groups: [], personas: [] }}
        textOf={textOf} onChange={setRows} onOpen={() => {}}
      />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </TooltipProvider>
  );
}

const rows = (): TraitRequirementRow[] => JSON.parse(screen.getByTestId('rows').textContent!);
const pickTime = async (button: string) => {
  fireEvent.click(screen.getByRole('button', { name: button }));
  fireEvent.click(await screen.findByRole('option', { name: /^Time of Day/ }));
};
const daypart = (name: string) => within(screen.getByRole('toolbar', { name: 'Time of day' })).getByRole('button', { name });

describe('a time Condition in the rows editor', () => {
  it('adds a chip on night alone, with no owner page, on and off world', async () => {
    for (const offWorld of [false, true]) {
      const { unmount } = render(<Harness offWorld={offWorld} />);
      await pickTime('Add Requirement');
      expect(rows()).toEqual([{ all: [{ kind: 'time', dayparts: ['night'] }] }]);
      expect(daypart('Night')).toHaveAttribute('aria-pressed', 'true');
      unmount();
    }
  });

  it('edits the dayparts in clock order and keeps the last one on', async () => {
    render(<Harness initial={[{ all: [{ kind: 'time', dayparts: ['night'] }] }]} />);
    expect(daypart('Night')).toBeDisabled();
    fireEvent.click(daypart('Evening'));
    expect(rows()).toEqual([{ all: [{ kind: 'time', dayparts: ['night', 'evening'] }] }]);
    expect(screen.getByRole('group', { name: 'evening or night' })).toBeInTheDocument();
    fireEvent.click(daypart('Night'));
    expect(rows()).toEqual([{ all: [{ kind: 'time', dayparts: ['evening'] }] }]);
    expect(daypart('Evening')).toBeDisabled();
  });

  it('has no Not flip, and a row takes one time Condition', async () => {
    render(<Harness initial={[{ all: [{ kind: 'time', dayparts: ['night'] }] }]} />);
    expect(screen.queryByRole('button', { name: /to be off$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'And' }));
    expect(await screen.findByRole('option', { name: /^Time of Day/ })).toHaveAttribute('aria-disabled', 'true');
  });
});
