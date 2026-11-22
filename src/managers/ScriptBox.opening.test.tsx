import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import type { Entity, Script } from '@/types';
import { statCodeNames, type StatCodeWorld } from '@/lib/statCodeTestRun';
import { useOpeningPick } from '@/lib/testBench/useOpeningPick';
import { OpeningPickProvider } from '@/contexts/OpeningPickContext';
import { OpeningPickSelect } from '@/components/editor/OpeningPickSelect';
import { ScriptBox, type ScriptBoxContext } from './ScriptBox';

/** Test Code and the Test Bench share one Opening pick: None first, then the pick either surface made. */

vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string }) => (
    <textarea aria-label={props.ariaLabel} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
  ),
}));

const pell = { id: 'pell', name: 'Pell', traits: [], openings: [{ id: 'o1', name: 'lantern', text: 'Pell lifts a lantern.', kind: 'action' }] } as unknown as Entity;
const world: StatCodeWorld = {
  stats: [{ id: 'h', name: 'Health', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] }],
  statGroups: [], traits: [], traitGroups: [], entities: [pell], entityGroups: [], placeholders: [], placeholderGroups: [], dictionaries: [],
};
const context: ScriptBoxContext = { owner: null, names: statCodeNames(world), world, ownerStats: [], selfName: '', placeholderPlaces: [], home: { kind: 'world' } };
const LABEL = 'World · After the AI';
const script: Script = { id: 's', timing: 'after', code: 'stats.Health.value = opening === null ? 11 : opening.name === "lantern" ? 77 : 0;' };

/** The World Editor's wiring: one pick, provided to the boxes, with the Bench's picker beside them. */
function Editor({ children }: { children: ReactNode }) {
  const pick = useOpeningPick('w1', { ...world, locations: [] });
  return (
    <OpeningPickProvider value={pick}>
      <OpeningPickSelect {...pick} label="Bench Opening" />
      {children}
    </OpeningPickProvider>
  );
}

function Box() {
  const [code, setCode] = useState(script);
  return <ScriptBox script={code} label={LABEL} context={context} onChange={(next) => setCode({ ...code, code: next })} />;
}

/** The run's result line, never the code that wrote it. */
const result = () => document.querySelector('.text-success')?.textContent ?? '';

const pickOption = (combobox: HTMLElement, option: string) => {
  act(() => { fireEvent.keyDown(combobox, { key: 'Enter' }); });
  fireEvent.keyDown(screen.getByRole('option', { name: option }), { key: 'Enter' });
};

beforeEach(() => sessionStorage.clear());

describe('the shared Opening pick', () => {
  it('reads None in Test Code until the Bench picks an Opening, then reads the pick', async () => {
    const user = userEvent.setup();
    render(<Editor><Box /></Editor>);
    const boxPicker = screen.getByRole('combobox', { name: `Opening ${LABEL}` });
    expect(boxPicker).toHaveTextContent('None');

    await user.click(screen.getByRole('button', { name: `Test Code ${LABEL}` }));
    await waitFor(() => expect(result()).toBe('stats.Health.value = 11'));

    pickOption(screen.getByRole('combobox', { name: 'Bench Opening' }), 'lantern');
    expect(boxPicker).toHaveTextContent('lantern');
    await user.click(screen.getByRole('button', { name: `Test Code ${LABEL}` }));
    await waitFor(() => expect(result()).toBe('stats.Health.value = 77'));
  });

  it('keeps the pick for the session, per world', () => {
    const { unmount } = render(<Editor><Box /></Editor>);
    pickOption(screen.getByRole('combobox', { name: `Opening ${LABEL}` }), 'lantern');
    unmount();
    render(<Editor><Box /></Editor>);
    expect(screen.getByRole('combobox', { name: 'Bench Opening' })).toHaveTextContent('lantern');
  });

  it('shows no picker outside the World Editor', () => {
    render(<Box />);
    expect(screen.queryByRole('combobox', { name: `Opening ${LABEL}` })).toBeNull();
  });
});
