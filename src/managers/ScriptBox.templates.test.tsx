import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Script, Stat } from '@/types';
import { statCodeNames, type StatCodeWorld } from '@/lib/statCodeTestRun';
import type { UnitHome } from '@/lib/sandboxSnapshot';
import { ScriptBox, type ScriptBoxContext } from './ScriptBox';

/** The Templates button on each kind of box, end to end through the dialog. */

// A plain textarea over the same value: the real editor arrives on its own chunk with CodeMirror.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string; preview?: React.ReactNode }) => (
    <>
      <textarea aria-label={props.ariaLabel} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
      {props.preview}
    </>
  ),
}));
vi.mock('@/services/StatTemplateStorageService', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/StatTemplateStorageService')>(),
  listUserTemplates: async () => [],
}));

const stat = (id: string, name: string): Stat => ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] });
const world: StatCodeWorld = {
  stats: [stat('h', 'Health')], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [],
  placeholders: [], placeholderGroups: [], dictionaries: [],
  locations: [{ id: 'gate', name: 'North Gate' }, { id: 'inn', name: 'Inn', isStarting: true }],
};
const context = (home: UnitHome): ScriptBoxContext => ({
  owner: null, names: statCodeNames(world), world, ownerStats: [], selfName: '', placeholderPlaces: [], home,
});
const LABEL = 'Box · After the AI';

/** A box that keeps its own code, as its panel does. */
function Box({ home }: { home: UnitHome }) {
  const [script, setScript] = useState<Script>({ id: 's', timing: 'after', code: '' });
  return <ScriptBox script={script} label={LABEL} context={context(home)} onChange={(code) => setScript({ ...script, code })} />;
}

describe('the Templates button', () => {
  it('opens a world script box’s menu, which fills a location from the world', async () => {
    const user = userEvent.setup();
    render(<Box home={{ kind: 'world' }} />);
    await user.click(screen.getByRole('button', { name: `Templates ${LABEL}` }));
    await user.click(await screen.findByRole('button', { name: 'Leave When a Stat Runs Out' }));
    await user.click(screen.getByRole('combobox', { name: 'Stat' }));
    await user.click(await screen.findByRole('option', { name: 'Health' }));
    await user.click(screen.getByRole('combobox', { name: 'Place' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['North Gate', 'Inn']);
    await user.click(screen.getByRole('option', { name: 'North Gate' }));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));
    await waitFor(() => expect(screen.getByLabelText(`Code ${LABEL}`)).toHaveValue(
      'const stat = stats["Health"];\nif (stat.value <= stat.min) location.move("North Gate");',
    ));
  });

  it('lists stat templates, not world ones, in a stat box', async () => {
    const user = userEvent.setup();
    render(<Box home={{ kind: 'globalStat', stat: stat('h', 'Health') }} />);
    await user.click(screen.getByRole('button', { name: `Templates ${LABEL}` }));
    expect(await screen.findByRole('button', { name: 'Hourly Change' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave When a Stat Runs Out' })).toBeNull();
  });

  it('is absent from a trait box', () => {
    render(<Box home={{ kind: 'trait', trait: { id: 't', name: '' }, entityId: null }} />);
    expect(screen.queryByRole('button', { name: `Templates ${LABEL}` })).toBeNull();
  });
});
