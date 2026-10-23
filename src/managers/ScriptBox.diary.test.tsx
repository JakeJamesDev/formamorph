import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Script } from '@/types';
import { statCodeNames, type StatCodeWorld } from '@/lib/statCodeTestRun';
import { ScriptBox, type ScriptBoxContext } from './ScriptBox';

/** Test Code on the real sandbox: a `diary` target the authored world lacks is a warning, not a failure (Q46). */

// A plain textarea over the same value: the real editor arrives on its own chunk with CodeMirror.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string }) => (
    <textarea aria-label={props.ariaLabel} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
  ),
}));

const world: StatCodeWorld = {
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [{ id: 'e-tor', name: 'Tor' }], entityGroups: [], placeholders: [],
  placeholderGroups: [], dictionaries: [],
};
const context: ScriptBoxContext = { owner: null, names: statCodeNames(world), world, ownerStats: [], selfName: '', placeholderPlaces: [], home: { kind: 'world' } };
const LABEL = 'World · After the AI';

function Box({ initial }: { initial: Script }) {
  const [script, setScript] = useState(initial);
  return <ScriptBox script={script} label={LABEL} context={context} onChange={(code) => setScript({ ...script, code })} />;
}

describe('Test Code with a diary line', () => {
  it('lists a known target as a write and warns on an unknown one, with no error', async () => {
    const user = userEvent.setup();
    render(<Box initial={{ id: 's', timing: 'after', code: 'entities.Tor.diary("I lied.");\nentities.Stranger.diary("Hello.");' }} />);
    await user.click(screen.getByRole('button', { name: `Test Code ${LABEL}` }));

    expect(await screen.findByText('diary: Tor: I lied.')).toBeInTheDocument();
    expect(screen.getByText('Diary target “Stranger” may be discovered in play.')).toBeInTheDocument();
    expect(screen.queryByText(/^Error:/)).toBeNull();
  });
});
