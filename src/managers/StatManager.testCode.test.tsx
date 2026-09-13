import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Placeholder, Stat, Trait } from '@/types';
import { encodePlaceholderToken } from '@/lib/placeholders';
import StatManager from './StatManager';

/** Running the code and reading it are two different answers about the same text, and the panel has to
 *  show both. The editor itself is stubbed — what's under test is the row beneath it. */

const stats = [
  { id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10, code: '' },
  { id: 's2', name: 'Damp', type: 'number', value: 3, min: 0, max: 10 },
] as unknown as Stat[];

// The third name carries a chip, so the run has to key it on the placeholder's own name.
const beast = { id: 'p1', name: 'Beast', values: [] } as unknown as Placeholder;
const FURY = `${encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'pl1' })} Fury`;
const traits = [
  { id: 't1', name: 'Brave', statChanges: [] },
  { id: 't2', name: 'Night Owl', statChanges: [] },
  { id: 't3', name: FURY, statChanges: [] },
] as Trait[];

const updateStat = vi.fn();
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => ({ updateStat, stats, placeholders: [beast], traits }),
}));
vi.mock('@/lib/useBodyMorphNames', () => ({
  useBodyMorphSources: () => ({ sources: [], loading: false, load: vi.fn() }),
}));
vi.mock('@/components/prompt/PlaceholderField', () => ({
  PlaceholderNameField: (props: { value?: string }) => <input aria-label="Name" defaultValue={props.value} />,
}));

/** What each box handed the editor last render, by the editor's label. The completions and the underlines
 *  are the editor's own, so what the panel passes it is all the panel can be held to. */
const editorProps = vi.hoisted(() => new Map<string, Record<string, unknown>>());

// A plain textarea over the same value: the real editor arrives on its own chunk and brings CodeMirror
// with it, and neither is what this file is about.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string }) => {
    // The panel passes more than the three props this stub renders, and the case below reads those.
    editorProps.set(props.ariaLabel, props as unknown as Record<string, unknown>);
    return (
      <textarea
        aria-label={props.ariaLabel}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    );
  },
}));

const executeStatCode = vi.hoisted(() => vi.fn());
// Only the run is faked; the editor's reader still imports the executor's real surface lists.
vi.mock('@/lib/statCodeExecutor', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/statCodeExecutor')>(),
  executeStatCode,
}));

/** The report beside one box's Test Code button. The button and its report share a row, so the row is
 *  the button's grandparent: the buttons sit in a group of their own inside it. */
const row = (box: 'Before The AI' | 'After The AI' = 'After The AI') =>
  screen.getByRole('button', { name: `Test Code ${box}` }).parentElement?.parentElement as HTMLElement;

/** The code editor lives on the panel's Code tab, so every case here opens there. The tab an author picks
 *  belongs to the editor, which is why it arrives as a prop rather than being clicked to. */
const renderCodePanel = (stat: Stat) => render(<StatManager stat={stat} tab="code" onTabChange={() => {}} />);

/** Put code in one box the way an author would, and run that box. */
async function testCode(
  user: ReturnType<typeof userEvent.setup>, code: string, box: 'Before The AI' | 'After The AI' = 'After The AI',
) {
  const field = screen.getByLabelText(`Stat Code ${box}`);
  await user.clear(field);
  await user.paste(code);
  await user.click(screen.getByRole('button', { name: `Test Code ${box}` }));
}

describe('what each box completes and checks against', () => {
  /** What one box hands the editor, as the options its reader and its completions take. */
  const optionsOf = (box: 'Before The AI' | 'After The AI') => {
    const props = editorProps.get(`Stat Code ${box}`)!;
    return {
      statNames: props.statNames as string[],
      selfName: props.selfName as string,
      placeholders: props.placeholders as { list: Placeholder[] },
      traits: props.traits as string[],
    };
  };

  it('hands both editors the same names, so a lookup reads alike in either box', () => {
    renderCodePanel(stats[0]);
    expect(optionsOf('Before The AI')).toEqual(optionsOf('After The AI'));
    // Not vacuously equal: the world's stats and traits are actually in there.
    expect(optionsOf('Before The AI').statNames).toEqual(['Warmth', 'Damp']);
    expect(optionsOf('Before The AI').selfName).toBe('Warmth');
    expect(optionsOf('Before The AI').traits).toEqual(['Brave', 'Night Owl', 'Beast Fury']);
  });

  // The acceptance case, run through the real reader and the real completion source rather than compared
  // prop by prop: a typo underlines in the before box and the world's own name does not, exactly as after.
  it('underlines an unknown stat in either box, and completes the real one there', async () => {
    const { statCodeCompletions, statCodeDiagnostics } = await import('@/lib/statCodeAnalysis');
    renderCodePanel(stats[0]);
    for (const box of ['Before The AI', 'After The AI'] as const) {
      const options = optionsOf(box);
      const typo = statCodeDiagnostics('return stats["Vigour"].value;', options);
      expect([box, typo.map((d) => d.message)]).toEqual([box, [expect.stringContaining('Vigour')]]);
      expect([box, statCodeDiagnostics('return stats["Damp"].value;', options)]).toEqual([box, []]);

      const code = 'return stats[""];';
      const offered = statCodeCompletions(code, code.indexOf('""') + 1, options)?.options.map((o) => o.label);
      expect([box, offered]).toEqual([box, expect.arrayContaining(['Warmth', 'Damp'])]);
    }
  });
});

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
      placeholders: [
        { id: 'ph-mood', path: ['Mood'], value: 'Furious' },
        { id: 'ph-hair', path: ['Hair'], unpin: true },
      ],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'self.max = 60; placeholders.Mood.value = "Furious"; placeholders.Hair.unpin(); return 5;');

    await waitFor(() => expect(row()).toHaveTextContent('Result: 5 · Max: 60 · Mood = Furious · Hair unpinned'));
  });

  // A write through a path names the placeholder the way the editor does, not by its bare name: two
  // placeholders can share one, so `Hair` alone would not say which one the run pinned.
  it('names a placeholder the run reached by a path with the whole path', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: null, error: null, placeholders: [{ id: 'ph-shade', path: ['Molly', 'Hair', 'Shade'], value: 'ash' }],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'placeholders.Molly.Hair.Shade.pin("ash");');

    await waitFor(() => expect(row()).toHaveTextContent('Molly › Hair › Shade = ash'));
  });

  // An Object pins to a list. The report is one line per placeholder, so it prints the list as its text.
  it('prints a list pin as the joined text one line holds', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({
      value: null, error: null,
      placeholders: [{ id: 'ph-hair', path: ['Hair'], value: ['silver', 'cropped short'] }],
    });
    renderCodePanel(stats[0]);

    await testCode(user, 'placeholders.Hair.pin(["silver", "cropped short"]);');

    await waitFor(() => expect(row()).toHaveTextContent('Hair = silver, cropped short'));
  });

  it('names the placeholders whose writes were dropped', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: null, error: null, unknownPlaceholders: ['Nope', 'Molly › Gone'] });
    renderCodePanel(stats[0]);

    await testCode(user, 'placeholders[["No", "pe"].join("")] = "x";');

    await waitFor(() => expect(row())
      .toHaveTextContent('No placeholder answers these paths, so code did not change them: Nope, Molly › Gone.'));
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
      { name: 'Beast Fury', enabled: false, acquired: false },
    ]);
    // The world keeps its authored names, chip token and all: only the sandbox entries read the code name.
    expect(traits).toEqual([
      { id: 't1', name: 'Brave', statChanges: [] },
      { id: 't2', name: 'Night Owl', statChanges: [] },
      { id: 't3', name: FURY, statChanges: [] },
    ]);
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

    await user.type(screen.getByLabelText('Stat Code After The AI'), ' ');
    expect(row()).not.toHaveTextContent('Result:');
    expect(row()).not.toHaveTextContent('in this code');
  });
});

describe('a box tests itself', () => {
  beforeEach(() => {
    executeStatCode.mockReset();
    updateStat.mockReset();
  });

  it('runs the box whose button was pressed, on that box’s own code', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 11, error: null });
    renderCodePanel({ ...stats[0], beforeCode: 'return 11;', code: 'return 22;' } as Stat);

    await user.click(screen.getByRole('button', { name: 'Test Code Before The AI' }));

    await waitFor(() => expect(row('Before The AI')).toHaveTextContent('Result: 11'));
    expect(executeStatCode.mock.calls[0][0]).toBe('return 11;');
    // The other box stays silent: its code was never run.
    expect(row('After The AI')).not.toHaveTextContent('Result:');
  });

  // `previous` reads as the stat itself and every `delta` reads zero when the run is handed no turn — which
  // is exactly what the before box reads in play, so the editor's run says the same thing the turn will.
  it('runs the before box with no turn behind it, so every delta reads zero', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 3, error: null });
    renderCodePanel({ ...stats[0], beforeCode: 'return self.delta.ai.value + 3;' } as Stat);

    await user.click(screen.getByRole('button', { name: 'Test Code Before The AI' }));

    await waitFor(() => expect(row('Before The AI')).toHaveTextContent('Result: 3'));
    expect(executeStatCode.mock.calls[0][3]).not.toHaveProperty('turn');
  });

  // The before box runs at turn start, so it has consumed no hours and, with none elapsed, stands on the
  // opening turn — the one its own templates are written for.
  it('runs each box on the clock that box gets', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 1, error: null });
    renderCodePanel({ ...stats[0], beforeCode: 'return 1;', code: 'return 1;' } as Stat);

    await user.click(screen.getByRole('button', { name: 'Test Code Before The AI' }));
    await waitFor(() => expect(executeStatCode).toHaveBeenCalled());
    expect(executeStatCode.mock.calls[0][3].clock).toEqual({ deltaHours: 0, elapsedHours: 0 });

    await user.click(screen.getByRole('button', { name: 'Test Code After The AI' }));
    await waitFor(() => expect(executeStatCode).toHaveBeenCalledTimes(2));
    expect(executeStatCode.mock.calls[1][3].clock).toEqual({ deltaHours: 1, elapsedHours: 1 });
  });

  it('clears only the edited box’s report', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 11, error: null });
    renderCodePanel({ ...stats[0], beforeCode: 'return 11;' } as Stat);

    await user.click(screen.getByRole('button', { name: 'Test Code Before The AI' }));
    await waitFor(() => expect(row('Before The AI')).toHaveTextContent('Result: 11'));

    executeStatCode.mockResolvedValue({ value: 22, error: null });
    await testCode(user, 'return 22;');
    await waitFor(() => expect(row('After The AI')).toHaveTextContent('Result: 22'));
    // Running and editing the other box left this one's report where it was.
    expect(row('Before The AI')).toHaveTextContent('Result: 11');

    await user.type(screen.getByLabelText('Stat Code Before The AI'), ' ');
    expect(row('Before The AI')).not.toHaveTextContent('Result:');
    expect(row('After The AI')).toHaveTextContent('Result: 22');
  });

  // The whole point of a per-box menu: what it inserts lands in that box and runs from that box's own
  // button. The before menu's Opening Turn Value returns nothing on a later turn, so a Result here also
  // says the run used the opening-turn clock the before box gets.
  it('inserts a before-menu template into the before box and runs it there', async () => {
    const user = userEvent.setup();
    executeStatCode.mockResolvedValue({ value: 50, error: null });
    renderCodePanel(stats[0]);

    await user.click(screen.getByRole('button', { name: 'Templates Before The AI' }));
    await user.click(await screen.findByRole('button', { name: 'Opening Turn Value' }));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));

    const inserted = ['if (elapsedHours > 0) return;', 'return 50;'].join('\n');
    await waitFor(() => expect(screen.getByLabelText('Stat Code Before The AI')).toHaveValue(inserted));
    // Into the before box alone: the after box is untouched.
    expect(screen.getByLabelText('Stat Code After The AI')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Test Code Before The AI' }));
    await waitFor(() => expect(row('Before The AI')).toHaveTextContent('Result: 50'));
    expect(executeStatCode.mock.calls[0][0]).toBe(inserted);
  });
  it('offers no run on an empty box', async () => {
    renderCodePanel({ ...stats[0], beforeCode: '   ', code: 'return 1;' } as Stat);

    expect(screen.getByRole('button', { name: 'Test Code Before The AI' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Test Code After The AI' })).toBeEnabled();
  });
});
