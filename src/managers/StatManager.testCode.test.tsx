import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Stat, Trait } from '@/types';
import StatManager from './StatManager';

/** Running the code and reading it are two different answers about the same text, and the panel has to
 *  show both. The editor itself is stubbed — what's under test is the row beneath it. */

const stats = [
  { id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10, code: '' },
  { id: 's2', name: 'Damp', type: 'number', value: 3, min: 0, max: 10 },
] as unknown as Stat[];

const traits = [{ id: 't1', name: 'Brave', statChanges: [] }, { id: 't2', name: 'Night Owl', statChanges: [] }] as Trait[];

const updateStat = vi.fn();
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({ updateStat, stats, placeholders: [], traits }),
}));
vi.mock('@/lib/useBodyMorphNames', () => ({
  useBodyMorphSources: () => ({ sources: [], loading: false, load: vi.fn() }),
}));
vi.mock('@/components/prompt/PlaceholderField', () => ({
  PlaceholderNameField: (props: { value?: string }) => <input aria-label="Name" defaultValue={props.value} />,
}));

// A plain textarea over the same value: the real editor arrives on its own chunk and brings CodeMirror
// with it, and neither is what this file is about.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string }) => (
    <textarea
      aria-label={props.ariaLabel}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  ),
}));

const executeStatCode = vi.hoisted(() => vi.fn());
// Only the run is faked; the editor's reader still imports the executor's real surface lists.
vi.mock('@/lib/statCodeExecutor', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/statCodeExecutor')>(),
  executeStatCode,
}));

const row = () => screen.getByRole('button', { name: /Test Code/ }).parentElement as HTMLElement;

/** The code editor lives on the panel's Code tab, so every case here opens there. The tab an author picks
 *  belongs to the editor, which is why it arrives as a prop rather than being clicked to. */
const renderCodePanel = (stat: Stat) => render(<StatManager stat={stat} tab="code" onTabChange={() => {}} />);

/** Put code in the field the way an author would, and run it. */
async function testCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  const field = screen.getByLabelText('Stat Code');
  await user.clear(field);
  await user.paste(code);
  await user.click(screen.getByRole('button', { name: /Test Code/ }));
}

describe('what Test Code reports', () => {
  beforeEach(() => {
    executeStatCode.mockReset();
    updateStat.mockReset();
  });

  it('says how many problems the reader found beside the number the run produced', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null });
    renderCodePanel(stats[0]);

    // Runs perfectly — the branch holding the typo is never taken, which is exactly why running it
    // proves nothing about the typo.
    await testCode(user, 'if (false) { return nope; } return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5'));
    await waitFor(() => expect(row()).toHaveTextContent('1 error in this code'));
  });

  it('runs over the world’s stats and counts a stat name the world does not have', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 3, error: null });
    renderCodePanel(stats[0]);

    // Damp is in the world and Warmth is this stat's own entry; Dmap is a typo.
    await testCode(user, 'stats.Warmth.value = stats.Damp.value; return stats.Dmap.value;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 3'));
    await waitFor(() => expect(row()).toHaveTextContent('1 error in this code'));
    expect(executeStatCode.mock.calls[0][1]).toBe(stats);
  });

  it('leaves a clean result clean, with nothing to qualify it', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null });
    renderCodePanel(stats[0]);

    await testCode(user, 'return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5'));
    expect(row()).not.toHaveTextContent('in this code');
  });

  it('lists every bound the run wrote beside the value', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null, bounds: { regen: 2, max: 60 } });
    renderCodePanel(stats[0]);

    await testCode(user, 'self.max = 60; self.regen = 2; return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5 · Max: 60 · Regen: 2'));
  });

  it('lists the bounds of a run that wrote no value', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, bounds: { min: 3 } });
    renderCodePanel(stats[0]);

    await testCode(user, 'self.min = 3;');

    await waitFor(() => expect(row()).toHaveTextContent('Min: 3'));
    expect(row()).not.toHaveTextContent('Result:');
  });

  it('lists every placeholder the run wrote or unpinned beside the value', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: 5, error: null, bounds: { max: 60 },
      placeholders: [{ name: 'Mood', text: 'Furious' }, { name: 'Hair', unpin: true }],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'self.max = 60; placeholders.Mood.value = "Furious"; placeholders.Hair.unpin(); return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5 · Max: 60 · Mood = Furious · Hair unpinned'));
  });

  it('names the placeholders whose writes were dropped', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, unknownPlaceholders: ['Nope', 'Gone'] });
    renderCodePanel(stats[0]);

    await testCode(user, 'placeholders[["No", "pe"].join("")] = "x";');

    await waitFor(() => expect(row()).toHaveTextContent('No placeholder has these names, so code did not change them: Nope, Gone.'));
    expect(row()).not.toHaveTextContent('Result:');
  });

  it('runs over the world’s traits with none acquired, and lists each switch without making it', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null, traits: [{ name: 'Brave', enabled: true }] });
    renderCodePanel(stats[0]);

    await testCode(user, 'traits.Brave.enabled = true; return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5 · Brave switched on'));
    expect(executeStatCode.mock.calls[0][3].traits).toEqual([
      { name: 'Brave', enabled: false, acquired: false },
      { name: 'Night Owl', enabled: false, acquired: false },
    ]);
    expect(traits).toEqual([{ id: 't1', name: 'Brave', statChanges: [] }, { id: 't2', name: 'Night Owl', statChanges: [] }]);
  });

  it('names the trait switches and acquired writes that did nothing', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, unknownTraits: ['Nope'], acquiredWrites: ['Brave'] });
    renderCodePanel(stats[0]);

    await testCode(user, 'traits.Nope = true; traits.Brave.acquired = true;');

    await waitFor(() => expect(row()).toHaveTextContent('No trait has these names, so code did not switch them: Nope.'));
    expect(row()).toHaveTextContent('Code can’t change acquired, so these writes did nothing: Brave.');
  });

  it('still counts the problems when the run itself threw', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: "Error: 'nope' is not defined" });
    renderCodePanel(stats[0]);

    await testCode(user, 'const x = nope; return alsoNope;');

    await waitFor(() => expect(row()).toHaveTextContent('nope'));
    await waitFor(() => expect(row()).toHaveTextContent('2 errors in this code'));
  });

  it('drops the whole report once the code it described has been edited', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 5, error: null });
    renderCodePanel(stats[0]);

    await testCode(user, 'if (false) { return nope; } return 5;');
    await waitFor(() => expect(row()).toHaveTextContent('1 error in this code'));

    await user.type(screen.getByLabelText('Stat Code'), ' ');
    expect(row()).not.toHaveTextContent('Result:');
    expect(row()).not.toHaveTextContent('in this code');
  });
});
