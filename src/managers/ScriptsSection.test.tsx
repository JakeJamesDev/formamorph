import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Script } from '@/types';
import { statCodeNames, type StatCodeWorld } from '@/lib/statCodeTestRun';
import type { ScriptPatch } from '@/lib/scripts';
import type { ScriptBoxContext } from './ScriptBox';
import { ScriptRow } from './ScriptsSection';

/** The row's change boundary: whatever object the row draws from, a change reports Script fields alone. */

vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string }) => (
    <textarea aria-label={props.ariaLabel} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
  ),
}));

const world: StatCodeWorld = {
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [],
};
const context: ScriptBoxContext = { owner: null, names: statCodeNames(world), world, ownerStats: [], selfName: '', placeholderPlaces: [], home: { kind: 'world' } };
const SCRIPT_KEYS = new Set<string>(['name', 'timing', 'code', 'order']);

/** A row drawn from a code box: the script's fields plus everything a box adds. */
const boxed = {
  id: 's', name: 'Drain', timing: 'after', code: 'return 1;',
  home: { kind: 'stat', statId: 'h' }, stat: { id: 'h', name: 'Health' }, owner: null, runs: [{ owner: null }],
} as Script;

const renderRow = () => {
  const onChange = vi.fn<(patch: ScriptPatch) => void>();
  render(<ScriptRow script={boxed} ownerName="Health" context={context} onChange={onChange} onRemove={vi.fn()} />);
  return onChange;
};

describe('ScriptRow', () => {
  it('reports only the field each control edits, never the object it draws from', async () => {
    const onChange = renderRow();
    const user = userEvent.setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Code Drain' }), { target: { value: 'return 2;' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Sap' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '' } });
    await user.click(screen.getByRole('combobox', { name: 'Timing' }));
    await user.click(screen.getByRole('option', { name: 'At Game Start' }));

    const patches = onChange.mock.calls.map(([patch]) => patch);
    // A cleared name is a present key holding `undefined`, which the merge drops.
    expect(patches).toStrictEqual([{ code: 'return 2;' }, { name: 'Sap' }, { name: undefined }, { timing: 'start' }]);
    for (const patch of patches) expect(Object.keys(patch).filter((key) => !SCRIPT_KEYS.has(key))).toEqual([]);
  });
});
