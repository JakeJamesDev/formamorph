import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RequirementRowsField } from './RequirementRowsField';
import { conditionTexts, requirementOptions, ruleStates, NO_ACTIVE, type GateInput } from '@/lib/traitGates';
import type { TraitRequirementRow } from '@/types';

const base: GateInput = { global: { traits: [], groups: [] }, owners: [], active: NO_ACTIVE, entities: [], persona: { source: 'none' } };

/** The field over the real rule text, the real options and the real row states, with edits that land. */
function Harness({ initial = [], kinds }: { initial?: TraitRequirementRow[]; kinds?: GateInput['weatherKinds'] }) {
  const input: GateInput = { ...base, ...(kinds && { weatherKinds: kinds }) };
  const [rows, setRows] = useState(initial);
  return (
    <TooltipProvider>
      <RequirementRowsField
        rows={rows} states={ruleStates(input, null, rows)} placeholders={[]} options={requirementOptions(input, 'a')}
        textOf={conditionTexts(input)} onChange={setRows} onOpen={() => {}}
      />
      <output data-testid="rows">{JSON.stringify(rows)}</output>
    </TooltipProvider>
  );
}

const rows = (): TraitRequirementRow[] => JSON.parse(screen.getByTestId('rows').textContent!);
const kind = (name: string) => within(screen.getByRole('toolbar', { name: 'Weather' })).getByRole('button', { name });
const ALLOWED = ['clear', 'rain', 'storm'] as const;

describe('a weather Condition in the rows editor', () => {
  it('is offered only while Weather is on', async () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(screen.queryByRole('option', { name: /^Weather/ })).toBeNull();
    unmount();
    render(<Harness kinds={ALLOWED} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(await screen.findByRole('option', { name: /^Weather/ })).toBeInTheDocument();
  });

  it('adds a chip on the first allowed kind with no owner page, listing only the allowed kinds', async () => {
    render(<Harness kinds={ALLOWED} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    fireEvent.click(await screen.findByRole('option', { name: /^Weather/ }));
    expect(rows()).toEqual([{ all: [{ kind: 'weather', kinds: ['rain'] }] }]);
    expect(kind('Rain')).toHaveAttribute('aria-pressed', 'true');
    expect(kind('Clear')).toHaveAttribute('aria-pressed', 'false');
    expect(within(screen.getByRole('toolbar', { name: 'Weather' })).queryByRole('button', { name: 'Snow' })).toBeNull();
  });

  it('edits the kinds in list order and keeps the last one on', () => {
    render(<Harness kinds={ALLOWED} initial={[{ all: [{ kind: 'weather', kinds: ['storm'] }] }]} />);
    expect(kind('Storm')).toBeDisabled();
    fireEvent.click(kind('Clear'));
    expect(rows()).toEqual([{ all: [{ kind: 'weather', kinds: ['clear', 'storm'] }] }]);
    fireEvent.click(kind('Storm'));
    expect(rows()).toEqual([{ all: [{ kind: 'weather', kinds: ['clear'] }] }]);
    expect(kind('Clear')).toBeDisabled();
  });

  it('has no Not flip, and a row takes one weather Condition', async () => {
    render(<Harness kinds={ALLOWED} initial={[{ all: [{ kind: 'weather', kinds: ['rain'] }] }]} />);
    expect(screen.queryByRole('button', { name: /to be off$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'And' }));
    expect(await screen.findByRole('option', { name: /^Weather/ })).toHaveAttribute('aria-disabled', 'true');
  });
});
